<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\Spk;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SpkController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(Spk::with(['project'])->latest()->paginate($perPage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'spk_number' => 'required|string|unique:spks,spk_number',
            'subcon_name' => 'required|string',
            'subtotal' => 'required|numeric',
            'payment_terms' => 'nullable|string',
        ]);

        $tax = $validated['subtotal'] * 0.11;

        $spk = Spk::create([
            'project_id' => $validated['project_id'],
            'spk_number' => $validated['spk_number'],
            'subcon_name' => $validated['subcon_name'],
            'subtotal' => $validated['subtotal'],
            'tax_amount' => $tax,
            'total_amount' => $validated['subtotal'] + $tax,
            'payment_terms' => $validated['payment_terms'],
            'status' => 'DRAFT',
            'created_by' => $request->user()->id,
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
            $spk->update(['status' => 'PENDING_APPROVAL']);
            $this->log($request, $spk, 'SUBMIT');

            return $spk;
        });

        return response()->json(['message' => 'SPK dikirim untuk approval.', 'data' => $spk]);
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

        return response()->json(['message' => 'SPK disetujui.', 'data' => $spk]);
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
