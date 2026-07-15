<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;
use App\Models\Invoice;
use App\Models\InvoiceAttachment;
use App\Models\Opname;
use App\Models\PurchaseOrder;
use App\Models\Spk;
use App\Models\Transaction;
use App\Services\WorkflowNotificationService;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function __construct(private readonly WorkflowNotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(
            Invoice::with(['invoiceable', 'opname', 'transactions', 'attachments.uploader'])->latest()->paginate($perPage)
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'invoiceable_type' => ['required', 'string', Rule::in([PurchaseOrder::class, Spk::class])],
            'invoiceable_id' => 'required|integer',
            'invoice_number' => 'required|string|unique:invoices,invoice_number',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'opname_id' => [
                Rule::requiredIf(fn () => $request->input('invoiceable_type') === Spk::class),
                'nullable',
                'integer',
                'exists:opnames,id',
            ],
        ]);

        $invoice = DB::transaction(function () use ($validated) {
            if ($validated['invoiceable_type'] === PurchaseOrder::class) {
                $purchaseOrder = PurchaseOrder::query()
                    ->lockForUpdate()
                    ->findOrFail($validated['invoiceable_id']);

                WorkflowState::require(
                    $purchaseOrder->status,
                    ['RECEIVED'],
                    'Invoice material hanya dapat dibuat setelah barang diterima.'
                );

                if (Invoice::where('invoiceable_type', PurchaseOrder::class)
                    ->where('invoiceable_id', $purchaseOrder->id)
                    ->exists()) {
                    WorkflowState::fail('PO ini sudah memiliki invoice. Sistem saat ini mendukung satu invoice penuh per PO.');
                }

                $amount = $purchaseOrder->total_amount;
                unset($validated['opname_id']);
            } else {
                $spk = Spk::query()
                    ->lockForUpdate()
                    ->findOrFail($validated['invoiceable_id']);
                $opname = Opname::query()
                    ->lockForUpdate()
                    ->findOrFail($validated['opname_id']);

                WorkflowState::require(
                    $spk->status,
                    ['APPROVED'],
                    'Invoice SPK hanya dapat dibuat dari SPK yang sudah disetujui.'
                );
                WorkflowState::require(
                    (string) $opname->spk_id,
                    [(string) $spk->id],
                    'Opname harus berasal dari SPK yang dipilih.'
                );
                WorkflowState::require(
                    $opname->status,
                    ['APPROVED'],
                    'Invoice SPK hanya dapat dibuat dari opname yang telah disetujui.'
                );

                if (Invoice::where('opname_id', $opname->id)->exists()) {
                    WorkflowState::fail('Opname ini sudah memiliki invoice.');
                }

                $amount = $opname->amount;
            }

            return Invoice::create($validated + [
                'amount' => $amount,
                'status' => 'PENDING_ENGINEER',
            ]);
        });

        $this->notifications->toRole(
            'ENGINEER',
            'Invoice menunggu verifikasi Engineer',
            "Invoice {$invoice->invoice_number} baru dibuat dan perlu diverifikasi di menu Approval.",
            '/approval'
        );

        return response()->json([
            'message' => 'Invoice berhasil dibuat dan menunggu verifikasi engineer.',
            'data' => $invoice,
        ], 201);
    }

    public function verifyEngineer(Request $request, $id)
    {
        $invoice = DB::transaction(function () use ($request, $id) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $invoice->status,
                ['PENDING_ENGINEER'],
                'Invoice harus berstatus PENDING_ENGINEER sebelum diverifikasi engineer.'
            );
            $invoice->update(['status' => 'ENGINEER_VERIFIED']);
            $this->log($request, $invoice, 'ENGINEER_VERIFY');

            return $invoice;
        });

        $this->notifications->toRole(
            'VERIFIKATOR_KEU',
            'Invoice menunggu verifikasi Keuangan',
            "Invoice {$invoice->invoice_number} sudah diverifikasi Engineer dan menunggu verifikasi dokumen keuangan.",
            '/approval'
        );

        return response()->json(['message' => 'Invoice lolos verifikasi engineer.', 'data' => $invoice]);
    }

    public function verifyFinance(Request $request, $id)
    {
        $invoice = DB::transaction(function () use ($request, $id) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $invoice->status,
                ['ENGINEER_VERIFIED'],
                'Invoice harus lolos verifikasi engineer sebelum diverifikasi keuangan.'
            );

            $missingDocuments = $this->missingDocuments($invoice);
            if ($missingDocuments !== []) {
                WorkflowState::fail('Dokumen tagihan belum lengkap: ' . implode(', ', $missingDocuments) . '.');
            }
            $invoice->update(['status' => 'PENDING_APPROVAL']);
            $this->log($request, $invoice, 'FINANCE_VERIFY');

            return $invoice;
        });

        $this->notifications->toRole(
            'MGR_KOMERSIAL',
            'Invoice menunggu approval Manajer',
            "Invoice {$invoice->invoice_number} sudah lolos verifikasi keuangan dan menunggu approval.",
            '/approval'
        );

        return response()->json(['message' => 'Invoice lolos verifikasi finance dan menunggu approval manajer.', 'data' => $invoice]);
    }

    public function approveManager(Request $request, $id)
    {
        $invoice = DB::transaction(function () use ($request, $id) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $invoice->status,
                ['PENDING_APPROVAL'],
                'Invoice harus lolos verifikasi keuangan sebelum disetujui manajer.'
            );
            $invoice->update([
                'status' => 'PENDING_CASHFLOW',
                'cashflow_status' => 'PENDING',
            ]);
            $this->log($request, $invoice, 'MANAGER_APPROVE');

            return $invoice;
        });

        $this->notifications->toRole(
            'VERIFIKATOR_KEU',
            'Invoice menunggu finalisasi cashflow',
            "Invoice {$invoice->invoice_number} sudah disetujui Manajer. Finalisasi cashflow sebelum pembayaran.",
            '/approval'
        );

        return response()->json([
            'message' => 'Invoice disetujui Manajer dan menunggu finalisasi cashflow.',
            'data' => $invoice,
        ]);
    }

    public function executePayment(Request $request, $id)
    {
        $validated = $request->validate([
            'payment_method' => 'required|string',
            'amount' => 'nullable|numeric|min:0.01',
            'payment_date' => 'nullable|date',
            'proof_of_payment' => 'nullable|string',
            'proof_file' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]);

        $invoice = DB::transaction(function () use ($validated, $request, $id) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($id);

            WorkflowState::require($invoice->status, ['UNPAID', 'PARTIAL'], 'Invoice belum siap dibayar.');
            WorkflowState::require($invoice->cashflow_status, ['APPROVED'], 'Cashflow invoice belum disetujui.');

            $paid = (float) $invoice->transactions()->sum('amount');
            $remaining = max(0, (float) $invoice->amount - $paid);
            $paymentAmount = (float) ($validated['amount'] ?? $remaining);
            if ($paymentAmount <= 0 || $paymentAmount > $remaining) {
                WorkflowState::fail('Nilai pembayaran harus lebih dari nol dan tidak boleh melebihi sisa tagihan.');
            }

            $proof = $validated['proof_of_payment'] ?? null;
            if ($request->hasFile('proof_file')) {
                $file = $request->file('proof_file');
                $proof = $file->store("attachments/invoice/{$invoice->id}/payment", 'public');
                InvoiceAttachment::create([
                    'invoice_id' => $invoice->id,
                    'doc_type' => 'BUKTI_BAYAR',
                    'file_path' => $proof,
                    'file_name' => $file->getClientOriginalName(),
                    'uploaded_by' => $request->user()->id,
                ]);
            }

            $transaction = Transaction::create([
                'invoice_id' => $invoice->id,
                'payment_method' => $validated['payment_method'],
                'amount' => $paymentAmount,
                'payment_date' => $validated['payment_date'] ?? now()->toDateString(),
                'proof_of_payment' => $proof,
            ]);

            $invoice->update([
                'status' => ($paid + $paymentAmount) >= (float) $invoice->amount ? 'PAID' : 'PARTIAL',
            ]);

            $this->postPaymentJournal($invoice, $transaction);

            $this->log($request, $invoice, 'PAYMENT');

            return $invoice;
        });

        $this->notifications->toRole(
            'PURCHASING_LEGAL',
            'Pembayaran invoice dicatat',
            "Pembayaran untuk invoice {$invoice->invoice_number} sudah dicatat dengan status {$invoice->status}.",
            '/invoicing'
        );

        return response()->json([
            'message' => 'Pembayaran dan bukti bayar berhasil dicatat. Status Invoice: PAID.',
            'data' => $invoice->load('transactions'),
        ]);
    }

    public function cashflowApprove(Request $request, $id)
    {
        $validated = $request->validate([
            'cashflow_status' => ['required', Rule::in(['APPROVED', 'REJECTED'])],
        ]);

        $invoice = DB::transaction(function () use ($request, $id, $validated) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($id);
            WorkflowState::require($invoice->cashflow_status, ['PENDING'], 'Invoice sudah diproses cashflow.');
            WorkflowState::require($invoice->status, ['PENDING_CASHFLOW'], 'Invoice belum siap untuk approval cashflow.');

            $approved = $validated['cashflow_status'] === 'APPROVED';
            $invoice->update([
                'cashflow_status' => $validated['cashflow_status'],
                'status' => $approved ? 'UNPAID' : 'CASHFLOW_REJECTED',
            ]);
            $this->log($request, $invoice, 'CASHFLOW_' . $validated['cashflow_status']);

            return $invoice;
        });

        if ($invoice->cashflow_status === 'APPROVED') {
            $this->notifications->toRole(
                'KEU_KANTOR',
                'Invoice siap dibayar',
                "Cashflow invoice {$invoice->invoice_number} disetujui. Dokumen siap dieksekusi pembayarannya.",
                '/payment'
            );
        }

        return response()->json([
            'message' => 'Status cashflow invoice diperbarui.',
            'data' => $invoice,
        ]);
    }

    public function uploadAttachment(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);
        $validated = $request->validate([
            'doc_type' => 'required|in:INVOICE,PO,SPK,SURAT_JALAN,OPNAME,BAST,FAKTUR_PAJAK,OTHER',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,xlsx,xls|max:10240',
        ]);
        $file = $request->file('file');
        $path = $file->store("attachments/invoice/{$invoice->id}", 'public');
        $attachment = InvoiceAttachment::create([
            'invoice_id' => $invoice->id,
            'doc_type' => $validated['doc_type'],
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Dokumen tagihan diunggah.', 'data' => $attachment], 201);
    }

    public function deleteAttachment(InvoiceAttachment $attachment)
    {
        if ($attachment->file_path && Storage::disk('public')->exists($attachment->file_path)) {
            Storage::disk('public')->delete($attachment->file_path);
        }
        $attachment->delete();

        return response()->json(['message' => 'Dokumen tagihan dihapus.']);
    }

    private function missingDocuments(Invoice $invoice): array
    {
        $required = $invoice->invoiceable_type === PurchaseOrder::class
            ? ['INVOICE', 'PO', 'SURAT_JALAN']
            : ['INVOICE', 'SPK', 'OPNAME', 'BAST'];
        $available = $invoice->attachments()->pluck('doc_type')->all();

        return array_values(array_diff($required, $available));
    }

    private function postPaymentJournal(Invoice $invoice, Transaction $transaction): void
    {
        if (GeneralLedger::where('reference_type', Transaction::class)->where('reference_id', $transaction->id)->exists()) {
            return;
        }
        if (! ChartOfAccount::where('code', '5200')->exists() || ! ChartOfAccount::where('code', '1100')->exists()) {
            return;
        }

        $date = $transaction->payment_date;
        $journalNumber = $this->generateJournalNumber($date);
        $description = "Pembayaran invoice {$invoice->invoice_number}";
        $projectId = $invoice->invoiceable?->project_id;
        foreach ([['5200', $transaction->amount, 0], ['1100', 0, $transaction->amount]] as [$account, $debit, $credit]) {
            GeneralLedger::create([
                'journal_number' => $journalNumber,
                'transaction_date' => $date,
                'account_code' => $account,
                'description' => $description,
                'debit' => $debit,
                'credit' => $credit,
                'reference_type' => Transaction::class,
                'reference_id' => $transaction->id,
                'project_id' => $projectId,
                'created_by' => auth()->id(),
            ]);
        }
    }

    private function generateJournalNumber(string $date): string
    {
        $prefix = 'JRN-' . date('Ymd', strtotime($date)) . '-';
        $last = GeneralLedger::where('journal_number', 'like', $prefix . '%')->orderByDesc('journal_number')->value('journal_number');
        $sequence = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }

    private function log(Request $request, Invoice $invoice, string $action): void
    {
        ApprovalLog::create([
            'record_type' => Invoice::class,
            'record_id' => $invoice->id,
            'user_id' => $request->user()->id ?? 1,
            'action' => $action,
        ]);
    }
}
