<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\Invoice;
use App\Models\Opname;
use App\Models\PurchaseOrder;
use App\Models\Spk;
use App\Models\Transaction;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function index()
    {
        return response()->json(
            Invoice::with(['invoiceable', 'transactions'])->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'invoiceable_type' => ['required', 'string', Rule::in([PurchaseOrder::class, Spk::class])],
            'invoiceable_id'   => 'required|integer',
            'invoice_number'   => 'required|string|unique:invoices,invoice_number',
            'invoice_date'     => 'required|date',
            'due_date'         => 'nullable|date',
            'opname_id'        => [
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

        return response()->json([
            'message' => 'Invoice berhasil dibuat dan menunggu verifikasi engineer.',
            'data' => $invoice
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
            $invoice->update(['status' => 'PENDING_APPROVAL']);
            $this->log($request, $invoice, 'FINANCE_VERIFY');
            return $invoice;
        });

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
            $invoice->update(['status' => 'UNPAID']);
            $this->log($request, $invoice, 'MANAGER_APPROVE');
            return $invoice;
        });

        return response()->json([
            'message' => 'Invoice telah disetujui Manajer dan siap dibayar.',
            'data' => $invoice
        ]);
    }

    public function executePayment(Request $request, $id)
    {
        $validated = $request->validate([
            'payment_method' => 'required|string',
            'amount' => 'nullable|numeric|min:0',
            'payment_date' => 'nullable|date',
            'proof_of_payment' => 'nullable|string',
        ]);

        $invoice = DB::transaction(function () use ($validated, $request, $id) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($id);

            WorkflowState::require(
                $invoice->status,
                ['UNPAID'],
                'Hanya invoice yang sudah disetujui manajer yang dapat dibayar.'
            );
            WorkflowState::requireAmount(
                $validated['amount'] ?? $invoice->amount,
                $invoice->amount,
                'Nilai pembayaran harus sama dengan nilai invoice karena pembayaran parsial belum didukung.'
            );

            if ($invoice->transactions()->exists()) {
                WorkflowState::fail('Invoice ini sudah memiliki transaksi pembayaran.');
            }

            $invoice->update(['status' => 'PAID']);

            Transaction::create([
                'invoice_id' => $invoice->id,
                'payment_method' => $validated['payment_method'],
                'amount' => $validated['amount'] ?? $invoice->amount,
                'payment_date' => $validated['payment_date'] ?? now()->toDateString(),
                'proof_of_payment' => $validated['proof_of_payment'] ?? null,
            ]);

            $this->log($request, $invoice, 'PAYMENT');

            return $invoice;
        });

        return response()->json([
            'message' => 'Pembayaran dan bukti bayar berhasil dicatat. Status Invoice: PAID.',
            'data' => $invoice->load('transactions')
        ]);
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