<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\PurchaseOrder;
use App\Models\Spk;
use App\Services\WorkflowNotificationService;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SpkController extends Controller
{
    public function __construct(private readonly WorkflowNotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(Spk::with(['project', 'sourcePo'])->latest()->paginate($perPage));
    }

    public function show($id)
    {
        return response()->json(Spk::with(['project', 'sourcePo', 'progress'])->findOrFail($id));
    }

    public function store(Request $request)
    {
        if ($request->filled('po_id') && ! $request->filled('source_po_id')) {
            $request->merge(['source_po_id' => $request->input('po_id')]);
        }

        $validated = $request->validate([
            'project_id'    => 'required|exists:projects,id',
            'source_po_id'  => 'nullable|integer|exists:purchase_orders,id',
            'spk_number'    => 'required|string|unique:spks,spk_number',
            'spk_type'      => 'required|string|in:SUBKON,MANDOR',
            'subcon_name'   => 'required|string',
            'subtotal'      => 'required|numeric|min:0',
            'include_ppn'   => 'boolean',
            'payment_terms' => 'nullable|string',
            'jadwal_kirim'  => 'nullable|date',
        ]);

        $sourcePo = ! empty($validated['source_po_id']) ? PurchaseOrder::findOrFail($validated['source_po_id']) : null;
        if ($sourcePo && ($sourcePo->po_level !== 'PROJECT' || $sourcePo->routed_to !== 'SPK' || $sourcePo->status !== 'ROUTED')) {
            return response()->json([
                'message' => 'SPK harus berasal dari PO Proyek yang sudah diarahkan Engineer ke SPK.',
            ], 422);
        }
        if ($sourcePo && (int) $sourcePo->project_id !== (int) $validated['project_id']) {
            return response()->json(['message' => 'PO sumber SPK harus berasal dari proyek yang sama.'], 422);
        }
        if ($sourcePo && $sourcePo->childSpks()->exists()) {
            return response()->json(['message' => 'PO Proyek ini sudah memiliki SPK turunan.'], 422);
        }

        $includePpn = $validated['include_ppn'] ?? true;
        $tax = $includePpn ? $validated['subtotal'] * 0.11 : 0;

        $spk = Spk::create([
            'project_id'    => $validated['project_id'],
            'source_po_id'  => $validated['source_po_id'] ?? null,
            'spk_number'    => $validated['spk_number'],
            'spk_type'      => $validated['spk_type'],
            'subcon_name'   => $validated['subcon_name'],
            'subtotal'      => $validated['subtotal'],
            'tax_amount'    => $tax,
            'total_amount'  => $validated['subtotal'] + $tax,
            'include_ppn'   => $includePpn,
            'payment_terms' => $validated['payment_terms'] ?? null,
            'jadwal_kirim'  => $validated['jadwal_kirim'] ?? null,
            'status'        => 'DRAFT',
            'created_by'    => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Draft Surat Perintah Kerja (SPK) berhasil dibuat.',
            'data' => $spk,
        ], 201);
    }

    public function submit(Request $request, $id)
    {
        $spk = DB::transaction(function () use ($request, $id) {
            $spk = Spk::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $spk->status,
                ['DRAFT'],
                'Hanya SPK berstatus DRAFT yang dapat dikirim untuk approval.'
            );
            if (! $spk->source_po_id) {
                WorkflowState::fail('SPK harus memiliki PO Proyek sumber yang sudah diarahkan Engineer.');
            }
            $spk->update(['status' => 'PENDING_APPROVAL']);
            $this->log($request, $spk, 'SUBMIT');

            return $spk;
        });

        $this->notifications->toRole(
            'MGR_KOMERSIAL',
            'SPK menunggu approval',
            "SPK {$spk->spk_number} dikirim untuk persetujuan Manajer Komersial.",
            '/approval'
        );

        return response()->json(['message' => 'SPK dikirim ke Manajer Komersial untuk approval.', 'data' => $spk]);
    }

    public function approve(Request $request, $id)
    {
        $spk = DB::transaction(function () use ($request, $id) {
            $spk = Spk::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $spk->status,
                ['PENDING_APPROVAL'],
                'SPK harus berstatus PENDING_APPROVAL sebelum disetujui.'
            );
            $spk->update([
                'status' => 'APPROVED',
                'approved_by' => $request->user()->id,
            ]);
            $this->log($request, $spk, 'APPROVE');

            return $spk;
        });

        $this->notifications->toRole(
            'LAPANGAN',
            'SPK disetujui',
            "SPK {$spk->spk_number} sudah disetujui. Pekerjaan dapat dipantau melalui opname.",
            '/opname'
        );
        $this->notifications->toUser($spk->created_by, 'SPK disetujui', "SPK {$spk->spk_number} telah disetujui Manajer Komersial.", '/spk');

        return response()->json(['message' => 'SPK disetujui dan diteruskan ke proses opname.', 'data' => $spk]);
    }

    public function reject(Request $request, $id)
    {
        $spk = DB::transaction(function () use ($request, $id) {
            $spk = Spk::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $spk->status,
                ['PENDING_APPROVAL'],
                'SPK harus berstatus PENDING_APPROVAL sebelum ditolak.'
            );
            $spk->update(['status' => 'REJECTED']);
            $this->log($request, $spk, 'REJECT', $request->input('notes'));

            return $spk;
        });

        $this->notifications->toUser($spk->created_by, 'SPK ditolak', "SPK {$spk->spk_number} ditolak. Periksa catatan approval dan revisi dokumen.", '/spk');

        return response()->json(['message' => 'SPK ditolak.', 'data' => $spk]);
    }

    private function log(Request $request, Spk $spk, string $action, ?string $notes = null): void
    {
        ApprovalLog::create([
            'record_type' => Spk::class,
            'record_id' => $spk->id,
            'user_id' => $request->user()->id,
            'action' => $action,
            'notes' => $notes,
        ]);
    }
}
