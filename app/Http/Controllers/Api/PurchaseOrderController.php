<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApprovalLog;
use App\Models\PoAttachment;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Services\WorkflowNotificationService;
use App\Support\WorkflowState;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PurchaseOrderController extends Controller
{
    public function __construct(private readonly WorkflowNotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);
        $search = $request->query('search');

        $query = PurchaseOrder::with(['project', 'parentPo', 'childPurchaseOrders', 'childSpks', 'items.rabBudget'])->latest();

        if ($projectId = $request->query('project_id')) {
            $query->where('project_id', $projectId);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                  ->orWhere('supplier_name', 'like', "%{$search}%")
                  ->orWhereHas('project', fn($pq) => $pq->where('project_name', 'like', "%{$search}%"));
            });
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $poLevel = $request->input('po_level', 'PROJECT');

        // LAPANGAN can only create PROJECT level POs
        $user = $request->user();
        if ($poLevel === 'SUPPLIER' && $user->role && $user->role->role_name === 'LAPANGAN') {
            return response()->json(['message' => 'Lapangan tidak bisa membuat PO Supplier.'], 403);
        }

        // Base validation (both levels)
        $rules = [
            'project_id' => 'required|exists:projects,id',
            'parent_po_id' => 'nullable|integer|exists:purchase_orders,id',
            'po_number' => 'required|string|unique:purchase_orders,po_number',
            'date' => 'required|date',
            'po_level' => 'nullable|string|in:PROJECT,SUPPLIER',
            'po_type' => 'nullable|string|in:PURCHASE_ORDER,REVISI,ADDENDUM',
            'addendum_number' => 'nullable|integer|min:1',
            'items' => 'required|array|min:1',
            'items.*.rab_budget_id' => 'required|exists:rab_budgets,id',
            'items.*.item_name' => 'required|string',
            'items.*.qty' => 'required|numeric|min:0.01',
        ];

        if ($poLevel === 'SUPPLIER') {
            // Supplier PO: supplier + pricing required
            $rules['supplier_name'] = 'required|string';
            $rules['supplier_address'] = 'nullable|string';
            $rules['supplier_phone'] = 'nullable|string';
            $rules['supplier_contact_person'] = 'nullable|string';
            $rules['project_location'] = 'nullable|string';
            $rules['discount'] = 'nullable|numeric|min:0';
            $rules['include_ppn'] = 'nullable|boolean';
            $rules['catatan'] = 'nullable|string';
            $rules['faktur_pajak_nama'] = 'nullable|string';
            $rules['faktur_pajak_npwp'] = 'nullable|string';
            $rules['faktur_pajak_alamat'] = 'nullable|string';
            $rules['payment_terms'] = 'nullable|string';
            $rules['jadwal_kirim'] = 'nullable|date';
            $rules['items.*.unit_price'] = 'required|numeric|min:0';
        } else {
            // Project PO: lapangan input, no pricing
            $rules['supplier_name'] = 'nullable|string';
            $rules['items.*.unit_price'] = 'nullable|numeric|min:0';
        }

        $validated = $request->validate($rules);

        if ($poLevel === 'SUPPLIER') {
            if (! empty($validated['parent_po_id'])) {
                $parent = PurchaseOrder::with('items')->findOrFail($validated['parent_po_id']);
                if ($parent->po_level !== 'PROJECT' || $parent->routed_to !== 'PURCHASE_ORDER' || $parent->status !== 'ROUTED') {
                return response()->json([
                    'message' => 'PO Supplier harus berasal dari PO Proyek yang sudah diarahkan Engineer ke Purchase Order.',
                ], 422);
                }
                if ((int) $parent->project_id !== (int) $validated['project_id']) {
                return response()->json(['message' => 'PO induk harus berasal dari proyek yang sama.'], 422);
                }

                $parentQty = $parent->items->keyBy('rab_budget_id');
                foreach ($validated['items'] as $item) {
                    $source = $parentQty->get($item['rab_budget_id']);
                    if (! $source || (float) $item['qty'] > (float) $source->qty) {
                    return response()->json([
                        'message' => 'Item dan jumlah PO Supplier tidak boleh melebihi PO Proyek sumber.',
                    ], 422);
                    }
                }
            }
        }

        $budgetIds = collect($validated['items'])->pluck('rab_budget_id')->unique();
        $matchingBudgetCount = RabBudget::query()
            ->where('project_id', $validated['project_id'])
            ->whereIn('id', $budgetIds)
            ->count();

        if ($matchingBudgetCount !== $budgetIds->count()) {
            return response()->json([
                'message' => 'Setiap item PO harus berasal dari RAB pada proyek yang sama.',
            ], 422);
        }

        $approvedBudgetCount = RabBudget::query()
            ->where('project_id', $validated['project_id'])
            ->whereIn('id', $budgetIds)
            ->where('status', RabBudget::STATUS_APPROVED)
            ->count();

        if ($approvedBudgetCount !== $budgetIds->count()) {
            return response()->json([
                'message' => 'PO hanya dapat dibuat dari item RAB yang sudah disetujui.',
            ], 422);
        }

        try {
            $po = DB::transaction(function () use ($validated, $request, $poLevel) {
                $po = PurchaseOrder::create([
                    'project_id' => $validated['project_id'],
                    'parent_po_id' => $validated['parent_po_id'] ?? null,
                    'po_number' => $validated['po_number'],
                    'date' => $validated['date'],
                    'supplier_name' => $validated['supplier_name'] ?? null,
                    'po_type' => $validated['po_type'] ?? 'PURCHASE_ORDER',
                    'addendum_number' => $validated['addendum_number'] ?? null,
                    'supplier_address' => $validated['supplier_address'] ?? null,
                    'supplier_phone' => $validated['supplier_phone'] ?? null,
                    'supplier_contact_person' => $validated['supplier_contact_person'] ?? null,
                    'project_location' => $validated['project_location'] ?? null,
                    'discount' => $validated['discount'] ?? 0,
                    'include_ppn' => $validated['include_ppn'] ?? true,
                    'catatan' => $validated['catatan'] ?? null,
                    'faktur_pajak_nama' => $validated['faktur_pajak_nama'] ?? 'PT. SINAR CERAH SEMPURNA',
                    'faktur_pajak_npwp' => $validated['faktur_pajak_npwp'] ?? '002.652.984.2-331.000',
                    'faktur_pajak_alamat' => $validated['faktur_pajak_alamat'] ?? 'Karangrejo Barat No. 9 RT 002 RW 002, Tinjomoyo, Banyumanik, Semarang',
                    'payment_terms' => $validated['payment_terms'] ?? null,
                    'jadwal_kirim' => $validated['jadwal_kirim'] ?? null,
                    'status' => 'DRAFT',
                    'po_level' => $poLevel,
                    'created_by' => $request->user()->id,
                ]);

                $subtotal = 0;
                foreach ($validated['items'] as $item) {
                    $unitPrice = $poLevel === 'SUPPLIER' ? ($item['unit_price'] ?? 0) : 0;
                    $totalPrice = $item['qty'] * $unitPrice;
                    $subtotal += $totalPrice;

                    PoItem::create([
                        'purchase_order_id' => $po->id,
                        'rab_budget_id' => $item['rab_budget_id'],
                        'item_name' => $item['item_name'],
                        'qty' => $item['qty'],
                        'unit_price' => $unitPrice,
                        'total_price' => $totalPrice,
                    ]);
                }

                // Only calculate pricing for supplier-level POs
                if ($poLevel === 'SUPPLIER') {
                    $discount = $validated['discount'] ?? 0;
                    $subtotalAfterDiscount = $subtotal - $discount;
                    $includePpn = $validated['include_ppn'] ?? true;
                    $tax = $includePpn ? $subtotalAfterDiscount * 0.11 : 0;
                    $po->update([
                        'subtotal' => $subtotal,
                        'tax_amount' => $tax,
                        'total_amount' => $subtotalAfterDiscount + $tax,
                    ]);
                }

                return $po;
            });

            if ($po->po_level === 'PROJECT') {
                $this->notifications->toRole(
                    'ENGINEER',
                    'PO Proyek menunggu routing',
                    "PO {$po->po_number} baru dibuat. Verifikasi lalu arahkan ke PO Supplier atau SPK.",
                    '/approval'
                );
            }

            return response()->json([
                'message' => $po->po_level === 'PROJECT'
                    ? 'Draft PO Proyek dibuat dan dikirim ke Engineer untuk routing.'
                    : 'Draft PO Supplier berhasil dibuat. Kirim untuk approval setelah data lengkap.',
                'data' => $po->load('items'),
            ], 201);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Gagal membuat PO.', 'error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $po = PurchaseOrder::with([
            'items.rabBudget', 'project', 'parentPo', 'childPurchaseOrders', 'childSpks', 'attachments.uploader',
        ])->findOrFail($id);
        return response()->json($po);
    }

    public function update(Request $request, $id)
    {
        $po = PurchaseOrder::findOrFail($id);
        WorkflowState::require($po->status, ['DRAFT'], 'Hanya PO DRAFT yang bisa diedit.');

        $validated = $request->validate([
            'supplier_name' => 'nullable|string',
            'supplier_address' => 'nullable|string',
            'supplier_phone' => 'nullable|string',
            'supplier_contact_person' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'jadwal_kirim' => 'nullable|date',
            'include_ppn' => 'nullable|boolean',
            'discount' => 'nullable|numeric|min:0',
            'catatan' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.rab_budget_id' => 'required|exists:rab_budgets,id',
            'items.*.item_name' => 'required|string',
            'items.*.qty' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'nullable|numeric|min:0',
        ]);

        DB::transaction(function () use ($po, $validated) {
            $po->update(collect($validated)->except('items')->toArray());

            if (isset($validated['items'])) {
                $po->items()->delete();
                foreach ($validated['items'] as $item) {
                    $qty = $item['qty'];
                    $unitPrice = $item['unit_price'] ?? 0;
                    $po->items()->create([
                        'rab_budget_id' => $item['rab_budget_id'],
                        'item_name' => $item['item_name'],
                        'qty' => $qty,
                        'unit_price' => $unitPrice,
                        'total_price' => $qty * $unitPrice,
                    ]);
                }
                $subtotal = $po->items()->sum('total_price');
                $discount = $po->discount ?? 0;
                $afterDiscount = $subtotal - $discount;
                $taxAmount = $po->include_ppn ? round($afterDiscount * 0.11) : 0;
                $po->update([
                    'subtotal' => $subtotal,
                    'tax_amount' => $taxAmount,
                    'total_amount' => $afterDiscount + $taxAmount,
                ]);
            }
        });

        return response()->json(['message' => 'PO berhasil diupdate.', 'data' => $po->load('items.rabBudget')]);
    }

    public function submit(Request $request, $id)
    {
        $po = DB::transaction(function () use ($request, $id) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['DRAFT'],
                'Hanya PO berstatus DRAFT yang dapat dikirim untuk approval.'
            );
            if ($po->po_level === 'PROJECT') {
                WorkflowState::fail('PO Proyek harus diverifikasi dan diarahkan Engineer, bukan dikirim langsung untuk approval.');
            }
            if (! $po->parent_po_id) {
                WorkflowState::fail('PO Supplier harus memiliki PO Proyek sumber.');
            }
            $po->update(['status' => 'PENDING_APPROVAL']);
            $this->log($request, $po, 'SUBMIT');

            return $po;
        });

        $this->notifications->toRole(
            'MGR_KOMERSIAL',
            'PO Supplier menunggu approval',
            "PO {$po->po_number} dikirim untuk persetujuan Manajer Komersial.",
            '/approval'
        );

        return response()->json(['message' => 'PO dikirim ke Manajer Komersial untuk approval.', 'data' => $po]);
    }

    public function approve(Request $request, $id)
    {
        $po = DB::transaction(function () use ($request, $id) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['PENDING_APPROVAL'],
                'PO harus berstatus PENDING_APPROVAL sebelum disetujui.'
            );
            WorkflowState::require(
                $po->po_level,
                ['SUPPLIER'],
                'Hanya PO Supplier yang masuk approval Manajer Komersial.'
            );
            $po->update([
                'status' => 'APPROVED',
                'approved_by' => $request->user()->id,
            ]);
            $this->log($request, $po, 'APPROVE');

            return $po;
        });

        $this->notifications->toRole(
            'LAPANGAN',
            'PO Supplier disetujui',
            "PO {$po->po_number} sudah disetujui. Lanjutkan penerimaan barang saat barang tiba.",
            '/goods-receipts'
        );
        $this->notifications->toUser($po->created_by, 'PO Supplier disetujui', "PO {$po->po_number} telah disetujui Manajer Komersial.", '/po');

        return response()->json(['message' => 'PO disetujui dan diteruskan ke proses penerimaan barang.', 'data' => $po]);
    }

    public function reject(Request $request, $id)
    {
        $po = DB::transaction(function () use ($request, $id) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['PENDING_APPROVAL'],
                'PO harus berstatus PENDING_APPROVAL sebelum ditolak.'
            );
            $po->update(['status' => 'REJECTED']);
            $this->log($request, $po, 'REJECT', $request->input('notes'));

            return $po;
        });

        $this->notifications->toUser($po->created_by, 'PO Supplier ditolak', "PO {$po->po_number} ditolak. Periksa catatan approval dan revisi dokumen.", "/purchase-orders/{$po->id}");

        return response()->json(['message' => 'PO ditolak.', 'data' => $po]);
    }

    public function uploadAttachment(Request $request, $poId)
    {
        $po = PurchaseOrder::findOrFail($poId);

        $request->validate([
            'file' => 'required|file|max:10240|mimes:jpg,jpeg,png,pdf,xlsx',
            'notes' => 'nullable|string|max:500',
        ]);

        $file = $request->file('file');
        $path = $file->store("attachments/po/{$po->id}", 'public');

        $attachment = PoAttachment::create([
            'purchase_order_id' => $po->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
            'notes' => $request->input('notes'),
        ]);

        return response()->json([
            'message' => 'File berhasil diunggah.',
            'data' => $attachment->load('uploader'),
        ], 201);
    }

    public function deleteAttachment(PoAttachment $attachment)
    {
        if (Storage::disk('public')->exists($attachment->file_path)) {
            Storage::disk('public')->delete($attachment->file_path);
        }

        $attachment->delete();

        return response()->json(['message' => 'File berhasil dihapus.']);
    }

    public function getAttachments($poId)
    {
        $po = PurchaseOrder::findOrFail($poId);
        $attachments = $po->attachments()->with('uploader')->latest()->get();

        return response()->json($attachments);
    }

    public function route(Request $request, $id)
    {
        $validated = $request->validate([
            'routed_to' => 'required|in:PURCHASE_ORDER,SPK',
        ]);

        $po = DB::transaction(function () use ($request, $id, $validated) {
            $po = PurchaseOrder::lockForUpdate()->findOrFail($id);
            WorkflowState::require(
                $po->status,
                ['DRAFT'],
                'PO harus berstatus DRAFT sebelum di-route.'
            );
            WorkflowState::require(
                $po->po_level,
                ['PROJECT'],
                'Hanya PO Proyek yang dapat diarahkan Engineer.'
            );
            if ($po->childPurchaseOrders()->exists() || $po->childSpks()->exists()) {
                WorkflowState::fail('PO Proyek sudah memiliki dokumen turunan dan tidak dapat diarahkan ulang.');
            }
            $po->update([
                'routed_to' => $validated['routed_to'],
                'routed_by' => $request->user()->id,
                'routed_at' => now(),
                'status' => 'ROUTED',
            ]);
            $this->log($request, $po, 'ROUTE', "Routed to {$validated['routed_to']}");

            return $po;
        });

        $destination = $po->routed_to === 'SPK' ? 'SPK' : 'PO Supplier';
        $url = $po->routed_to === 'SPK' ? '/spk' : '/po';
        $this->notifications->toRole(
            'PURCHASING_LEGAL',
            "PO Proyek diteruskan ke {$destination}",
            "PO {$po->po_number} sudah dirouting Engineer. Buat dokumen {$destination} dari PO tersebut.",
            $url
        );
        $this->notifications->toUser($po->created_by, 'PO Proyek sudah dirouting', "PO {$po->po_number} diteruskan Engineer ke {$destination}.", $url);

        return response()->json(['message' => "PO berhasil diteruskan ke {$destination}.", 'data' => $po]);
    }

    private function log(Request $request, PurchaseOrder $po, string $action, ?string $notes = null): void
    {
        ApprovalLog::create([
            'record_type' => PurchaseOrder::class,
            'record_id' => $po->id,
            'user_id' => $request->user()->id,
            'action' => $action,
            'notes' => $notes,
        ]);
    }
}
