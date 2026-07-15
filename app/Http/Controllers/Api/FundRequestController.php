<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\ChartOfAccount;
use App\Models\FundRequest;
use App\Models\FundRequestAttachment;
use App\Models\GeneralLedger;
use App\Models\Transaction;
use App\Services\WorkflowNotificationService;
use App\Support\WorkflowState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FundRequestController extends Controller
{
    public function __construct(private readonly WorkflowNotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(FundRequest::with(['project', 'transactions', 'fundReceipts', 'attachments.uploader'])->latest()->paginate($perPage));
    }

    public function show($id)
    {
        return response()->json(FundRequest::with(['project', 'transactions', 'fundReceipts', 'attachments.uploader'])->findOrFail($id));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'request_number' => 'required|string|unique:fund_requests,request_number',
            'amount' => 'required|numeric|min:0',
            'description' => 'nullable|string',
        ]);

        $fundRequest = FundRequest::create($validated + [
            'status' => 'PENDING_VERIFICATION',
            'requested_by' => $request->user()->id,
        ]);
        $this->log($request, $fundRequest, 'SUBMIT');

        $this->notifications->toRole(
            'VERIFIKATOR_KEU',
            'Permohonan dana menunggu verifikasi',
            "Permohonan dana {$fundRequest->request_number} dikirim untuk verifikasi keuangan.",
            '/approval'
        );

        return response()->json(['message' => 'Permohonan dana dikirim ke Verifikator Keuangan.', 'data' => $fundRequest], 201);
    }

    public function verifyRequest(Request $request, $id)
    {
        $fundRequest = DB::transaction(function () use ($request, $id) {
            $fundRequest = FundRequest::query()->lockForUpdate()->findOrFail($id);
            WorkflowState::require($fundRequest->status, ['PENDING_VERIFICATION'], 'Permohonan dana belum siap diverifikasi.');
            $fundRequest->update([
                'status' => 'PENDING_APPROVAL',
                'verified_by' => $request->user()->id,
                'verified_at' => now(),
            ]);
            $this->log($request, $fundRequest, 'FINANCE_VERIFY');

            return $fundRequest;
        });

        $this->notifications->toRole(
            'MGR_KOMERSIAL',
            'Permohonan dana menunggu approval',
            "Permohonan dana {$fundRequest->request_number} sudah diverifikasi dan menunggu persetujuan Manajer.",
            '/approval'
        );

        return response()->json(['message' => 'Permohonan dana terverifikasi dan menunggu approval Manajer.', 'data' => $fundRequest]);
    }

    public function approve(Request $request, $id)
    {
        $fundRequest = DB::transaction(function () use ($request, $id) {
            $fundRequest = FundRequest::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($fundRequest->status !== 'PENDING_APPROVAL') {
                return response()->json(['message' => 'Permohonan dana harus berstatus PENDING_APPROVAL sebelum disetujui.'], 422);
            }

            $fundRequest->update([
                'status' => 'APPROVED',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);
            $this->log($request, $fundRequest, 'APPROVE');

            return $fundRequest->fresh();
        });

        if ($fundRequest instanceof JsonResponse) {
            return $fundRequest;
        }

        $this->notifications->toRole(
            'KEU_KANTOR',
            'Permohonan dana siap dibayar',
            "Permohonan dana {$fundRequest->request_number} disetujui dan siap dieksekusi pembayarannya.",
            '/payment'
        );
        $this->notifications->toUser($fundRequest->requested_by, 'Permohonan dana disetujui', "Permohonan dana {$fundRequest->request_number} sudah disetujui dan menunggu pembayaran.", '/fund-requests');

        return response()->json(['message' => 'Permohonan dana disetujui.', 'data' => $fundRequest]);
    }

    public function reject(Request $request, $id)
    {
        $validated = $request->validate(['notes' => 'nullable|string|max:1000']);
        $result = DB::transaction(function () use ($request, $id) {
            $fundRequest = FundRequest::where('id', $id)->lockForUpdate()->firstOrFail();

            if (! in_array($fundRequest->status, ['PENDING_VERIFICATION', 'PENDING_APPROVAL'], true)) {
                return response()->json(['message' => 'Permohonan dana sudah melewati tahap penolakan.'], 422);
            }

            $fundRequest->update(['status' => 'REJECTED', 'rejection_notes' => $request->input('notes')]);
            $this->log($request, $fundRequest, 'REJECT');

            return $fundRequest->fresh();
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        $this->notifications->toUser($result->requested_by, 'Permohonan dana ditolak', "Permohonan dana {$result->request_number} ditolak. Periksa catatan verifikator atau Manajer.", '/fund-requests');

        return response()->json(['message' => 'Permohonan dana ditolak.', 'data' => $result]);
    }

    public function pay(Request $request, $id)
    {
        $validated = $request->validate([
            'payment_method' => 'required|string',
            'amount' => 'nullable|numeric|min:0',
            'payment_date' => 'nullable|date',
            'proof_of_payment' => 'nullable|string',
            'proof_file' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]);

        $fundRequest = DB::transaction(function () use ($validated, $request, $id) {
            $fundRequest = FundRequest::query()->lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $fundRequest->status,
                ['APPROVED'],
                'Hanya permohonan dana yang sudah disetujui yang dapat dibayar.'
            );
            WorkflowState::requireAmount(
                $validated['amount'] ?? $fundRequest->amount,
                $fundRequest->amount,
                'Nilai pembayaran harus sama dengan nilai permohonan dana karena pembayaran parsial belum didukung.'
            );

            if ($fundRequest->transactions()->exists()) {
                WorkflowState::fail('Permohonan dana ini sudah memiliki transaksi pembayaran.');
            }

            $fundRequest->update(['status' => 'PAID', 'paid_at' => now()]);

            $proof = $validated['proof_of_payment'] ?? null;
            if ($request->hasFile('proof_file')) {
                $file = $request->file('proof_file');
                $proof = $file->store("attachments/fund-request/{$fundRequest->id}", 'public');
                FundRequestAttachment::create([
                    'fund_request_id' => $fundRequest->id,
                    'doc_type' => 'BUKTI_TRANSFER',
                    'file_path' => $proof,
                    'file_name' => $file->getClientOriginalName(),
                    'uploaded_by' => $request->user()->id,
                ]);
            }

            Transaction::create([
                'fund_request_id' => $fundRequest->id,
                'payment_method' => $validated['payment_method'],
                'amount' => $validated['amount'] ?? $fundRequest->amount,
                'payment_date' => $validated['payment_date'] ?? now()->toDateString(),
                'proof_of_payment' => $proof,
            ]);
            $this->log($request, $fundRequest, 'PAYMENT');

            // Auto GL posting: Debit Biaya Proyek, Credit Kas/Bank
            $this->postGlJournal($fundRequest, $validated['payment_date'] ?? now()->toDateString());

            return $fundRequest;
        });

        $this->notifications->toUser($fundRequest->requested_by, 'Dana proyek sudah dibayar', "Permohonan dana {$fundRequest->request_number} sudah dibayar. Lengkapi dan kirim LPJ setelah realisasi.", '/fund-requests');

        return response()->json(['message' => 'Dana proyek dibayar dan bukti dicatat.', 'data' => $fundRequest->load('transactions')]);
    }

    public function submitLpj(Request $request, $id)
    {
        $validated = $request->validate([
            'lpj_notes' => 'required|string',
            'lpj_items' => 'required|array|min:1',
            'lpj_items.*.description' => 'required|string',
            'lpj_items.*.amount' => 'required|numeric|min:0',
            'lpj_items.*.category' => 'nullable|string',
        ]);
        $fundRequest = FundRequest::findOrFail($id);
        WorkflowState::require(
            $fundRequest->status,
            ['PAID'],
            'LPJ hanya dapat dikirim setelah permohonan dana dibayar.'
        );
        $lpjTotal = collect($validated['lpj_items'])->sum(fn ($item) => (float) $item['amount']);
        WorkflowState::requireAmount($lpjTotal, $fundRequest->amount, 'Total rincian LPJ harus sama dengan dana yang diterima.');
        if (! $fundRequest->attachments()->where('doc_type', 'LPJ')->exists()) {
            WorkflowState::fail('Unggah minimal satu dokumen LPJ sebelum mengirim verifikasi.');
        }

        $fundRequest->update([
            'status' => 'LPJ_SUBMITTED',
            'lpj_notes' => $validated['lpj_notes'] ?? null,
            'lpj_items' => $validated['lpj_items'] ?? null,
            'lpj_submitted_at' => now(),
        ]);
        $this->log($request, $fundRequest, 'LPJ_SUBMIT');

        $this->notifications->toRole(
            'VERIFIKATOR_KEU',
            'LPJ menunggu verifikasi',
            "LPJ untuk permohonan dana {$fundRequest->request_number} dikirim untuk verifikasi keuangan.",
            '/approval'
        );

        return response()->json(['message' => 'LPJ dikirim untuk verifikasi.', 'data' => $fundRequest]);
    }

    public function verifyLpj(Request $request, $id)
    {
        $fundRequest = FundRequest::findOrFail($id);
        WorkflowState::require(
            $fundRequest->status,
            ['LPJ_SUBMITTED'],
            'LPJ harus berstatus LPJ_SUBMITTED sebelum diverifikasi.'
        );
        $fundRequest->update([
            'status' => 'LPJ_PENDING_APPROVAL',
            'lpj_verified_by' => $request->user()->id,
            'lpj_verified_at' => now(),
        ]);
        $this->log($request, $fundRequest, 'LPJ_VERIFY');

        $this->notifications->toRole(
            'MGR_KOMERSIAL',
            'LPJ menunggu approval',
            "LPJ untuk permohonan dana {$fundRequest->request_number} sudah diverifikasi dan menunggu persetujuan Manajer.",
            '/approval'
        );

        return response()->json(['message' => 'LPJ diverifikasi dan menunggu approval Manajer.', 'data' => $fundRequest]);
    }

    public function approveLpj(Request $request, $id)
    {
        $fundRequest = FundRequest::findOrFail($id);
        WorkflowState::require($fundRequest->status, ['LPJ_PENDING_APPROVAL'], 'LPJ belum siap disetujui Manajer.');
        $fundRequest->update([
            'status' => 'LPJ_APPROVED',
            'lpj_approved_by' => $request->user()->id,
            'lpj_approved_at' => now(),
        ]);
        $this->log($request, $fundRequest, 'LPJ_APPROVE');

        $this->notifications->toUser($fundRequest->requested_by, 'LPJ disetujui', "LPJ untuk permohonan dana {$fundRequest->request_number} sudah disetujui. Workflow selesai.", '/fund-requests');

        return response()->json(['message' => 'LPJ disetujui dan workflow permohonan dana selesai.', 'data' => $fundRequest]);
    }

    public function uploadAttachment(Request $request, $id)
    {
        $fundRequest = FundRequest::findOrFail($id);
        $validated = $request->validate([
            'doc_type' => 'required|in:LPJ,NOTA,BUKTI_TRANSFER,OTHER',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,xlsx,xls|max:10240',
        ]);
        $file = $request->file('file');
        $path = $file->store("attachments/fund-request/{$fundRequest->id}", 'public');
        $attachment = FundRequestAttachment::create([
            'fund_request_id' => $fundRequest->id,
            'doc_type' => $validated['doc_type'],
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Dokumen LPJ diunggah.', 'data' => $attachment], 201);
    }

    public function deleteAttachment(FundRequestAttachment $attachment)
    {
        if (Storage::disk('public')->exists($attachment->file_path)) {
            Storage::disk('public')->delete($attachment->file_path);
        }
        $attachment->delete();

        return response()->json(['message' => 'Dokumen LPJ dihapus.']);
    }

    /**
     * Post double-entry journal for fund request payment.
     * Debit: Biaya Operasional Proyek (5100) — expense recognized
     * Credit: Kas/Bank (1100) — cash outflow
     */
    private function postGlJournal(FundRequest $fundRequest, string $date): void
    {
        $expenseAccount = '5100'; // Biaya Operasional Proyek
        $cashAccount = '1100';    // Kas/Bank

        $expenseExists = ChartOfAccount::where('code', $expenseAccount)->exists();
        $cashExists = ChartOfAccount::where('code', $cashAccount)->exists();

        if (! $expenseExists || ! $cashExists) {
            // Skip GL posting if COA not configured — log warning
            return;
        }

        $journalNumber = $this->generateJournalNumber($date);
        $amount = (float) $fundRequest->amount;
        $description = "Pembayaran permohonan dana {$fundRequest->request_number}";

        GeneralLedger::create([
            'journal_number' => $journalNumber,
            'transaction_date' => $date,
            'account_code' => $expenseAccount,
            'description' => $description,
            'debit' => $amount,
            'credit' => 0,
            'reference_type' => FundRequest::class,
            'reference_id' => $fundRequest->id,
            'project_id' => $fundRequest->project_id,
            'created_by' => Auth::id(),
        ]);

        GeneralLedger::create([
            'journal_number' => $journalNumber,
            'transaction_date' => $date,
            'account_code' => $cashAccount,
            'description' => $description,
            'debit' => 0,
            'credit' => $amount,
            'reference_type' => FundRequest::class,
            'reference_id' => $fundRequest->id,
            'project_id' => $fundRequest->project_id,
            'created_by' => Auth::id(),
        ]);
    }

    private function generateJournalNumber(string $date): string
    {
        $datePart = date('Ymd', strtotime($date));
        $prefix = "JRN-{$datePart}-";
        $last = GeneralLedger::where('journal_number', 'like', $prefix . '%')
            ->orderByDesc('journal_number')
            ->value('journal_number');

        $seq = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    private function log(Request $request, FundRequest $fundRequest, string $action): void
    {
        ApprovalLog::create([
            'record_type' => FundRequest::class,
            'record_id' => $fundRequest->id,
            'user_id' => $request->user()->id,
            'action' => $action,
        ]);
    }
}
