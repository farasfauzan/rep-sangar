<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\Opname;
use App\Models\Spk;
use App\Support\WorkflowState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OpnameController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min($request->query('per_page', 15), 100);

        return response()->json(
            Opname::with(['spk.project'])->latest()->paginate($perPage)
        );
    }

    public function store(Request $request): JsonResponse
    {
        // Parameter 'amount' dihapus dari validasi karena sistem yang akan menghitungnya
        $validated = $request->validate([
            'spk_id' => 'required|exists:spks,id',
            'opname_number' => 'required|string|unique:opnames,opname_number',
            'date' => 'required|date',
            'progress_percentage' => 'required|numeric|min:0.01|max:100',
            'progress_pct' => 'nullable|integer|min:0|max:100',
            'progress_items' => 'nullable|array',
            'progress_items.*.description' => 'required|string',
            'progress_items.*.done' => 'required|boolean',
        ]);

        $opname = DB::transaction(function () use ($validated) {
            $spk = Spk::query()->lockForUpdate()->findOrFail($validated['spk_id']);
            
            WorkflowState::require(
                $spk->status,
                ['APPROVED'],
                'Opname hanya dapat dibuat untuk SPK yang sudah disetujui.'
            );

            // Hanya menjumlahkan akumulasi progres persentase
            $reserved = Opname::query()
                ->where('spk_id', $spk->id)
                ->whereIn('status', ['PENDING', 'APPROVED'])
                ->selectRaw('COALESCE(SUM(progress_percentage), 0) AS progress')
                ->first();

            if ((float) $reserved->progress + (float) $validated['progress_percentage'] > 100) {
                WorkflowState::fail('Akumulasi progres opname tidak boleh melebihi 100%.');
            }

            // PERBAIKAN: Hitung nilai uang (amount) secara otomatis di backend
            $calculatedAmount = ((float) $validated['progress_percentage'] / 100) * (float) $spk->total_amount;
            $calculatedAmount = round($calculatedAmount, 2);

            return Opname::create($validated + [
                'amount' => $calculatedAmount,
                'status' => 'PENDING'
            ]);
        });

        return response()->json([
            'message' => 'Opname berhasil dicatat.',
            'data' => $opname->load('spk'),
        ], 201);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $id) {
            $opname = Opname::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($opname->status !== 'PENDING') {
                return response()->json(['message' => 'Opname harus berstatus PENDING sebelum disetujui.'], 422);
            }

            $opname->update([
                'status' => 'APPROVED',
                'approved_by' => $request->user()?->id,
            ]);
            $this->log($request, $opname, 'APPROVE');

            return $opname->fresh();
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        return response()->json(['message' => 'Opname disetujui dan siap dibuatkan invoice.', 'data' => $result]);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $id) {
            $opname = Opname::where('id', $id)->lockForUpdate()->firstOrFail();

            if ($opname->status !== 'PENDING') {
                return response()->json(['message' => 'Opname harus berstatus PENDING sebelum ditolak.'], 422);
            }

            $opname->update(['status' => 'REJECTED']);
            $this->log($request, $opname, 'REJECT', $request->input('notes'));

            return $opname->fresh();
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        return response()->json(['message' => 'Opname ditolak.', 'data' => $result]);
    }

    private function log(Request $request, Opname $opname, string $action, ?string $notes = null): void
    {
        ApprovalLog::create([
            'record_type' => Opname::class,
            'record_id' => $opname->id,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'notes' => $notes,
        ]);
    }
}