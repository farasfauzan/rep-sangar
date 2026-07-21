<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FundRequest;
use App\Models\Invoice;
use App\Models\Opname;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Models\Spk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min($request->query('per_page', 15), 100);
        $projects = Project::select('id', 'project_name', 'location', 'start_date', 'status')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        $projectIds = $projects->getCollection()->pluck('id');
        $pendingCounts = array_fill_keys($projectIds->all(), 0);
        $pendingRabCounts = collect();
        $addCounts = function ($counts) use (&$pendingCounts): void {
            foreach ($counts as $projectId => $count) {
                $pendingCounts[$projectId] = ($pendingCounts[$projectId] ?? 0) + (int) $count;
            }
        };

        if ($projectIds->isNotEmpty()) {
            $pendingRabCounts = RabBudget::query()
                ->whereIn('project_id', $projectIds)
                ->where('status', RabBudget::STATUS_PENDING)
                ->whereRaw('version = (SELECT MAX(latest.version) FROM rab_budgets AS latest WHERE latest.project_id = rab_budgets.project_id AND latest.deleted_at IS NULL)')
                ->selectRaw('project_id, COUNT(*) as aggregate')
                ->groupBy('project_id')
                ->pluck('aggregate', 'project_id');
            $addCounts($pendingRabCounts);

            $addCounts(PurchaseOrder::query()
                ->whereIn('project_id', $projectIds)
                ->where(function ($query): void {
                    $query
                        ->where(function ($projectPo): void {
                            $projectPo->where('po_level', 'PROJECT')->where('status', 'DRAFT');
                        })
                        ->orWhere(function ($supplierPo): void {
                            $supplierPo->where('po_level', 'SUPPLIER')->where('status', 'PENDING_APPROVAL');
                        });
                })
                ->selectRaw('project_id, COUNT(*) as aggregate')
                ->groupBy('project_id')
                ->pluck('aggregate', 'project_id'));

            $addCounts(Spk::query()
                ->whereIn('project_id', $projectIds)
                ->where('status', 'PENDING_APPROVAL')
                ->selectRaw('project_id, COUNT(*) as aggregate')
                ->groupBy('project_id')
                ->pluck('aggregate', 'project_id'));

            $addCounts(Opname::query()
                ->join('spks', 'opnames.spk_id', '=', 'spks.id')
                ->whereIn('spks.project_id', $projectIds)
                ->where('opnames.status', 'PENDING')
                ->selectRaw('spks.project_id, COUNT(*) as aggregate')
                ->groupBy('spks.project_id')
                ->pluck('aggregate', 'spks.project_id'));

            $pendingInvoiceStatuses = ['PENDING_ENGINEER', 'ENGINEER_VERIFIED', 'PENDING_APPROVAL', 'PENDING_CASHFLOW'];
            $addCounts(Invoice::query()
                ->join('purchase_orders', 'invoices.invoiceable_id', '=', 'purchase_orders.id')
                ->where('invoices.invoiceable_type', (new PurchaseOrder)->getMorphClass())
                ->whereIn('purchase_orders.project_id', $projectIds)
                ->whereIn('invoices.status', $pendingInvoiceStatuses)
                ->selectRaw('purchase_orders.project_id, COUNT(*) as aggregate')
                ->groupBy('purchase_orders.project_id')
                ->pluck('aggregate', 'purchase_orders.project_id'));

            $addCounts(Invoice::query()
                ->join('spks', 'invoices.invoiceable_id', '=', 'spks.id')
                ->where('invoices.invoiceable_type', (new Spk)->getMorphClass())
                ->whereIn('spks.project_id', $projectIds)
                ->whereIn('invoices.status', $pendingInvoiceStatuses)
                ->selectRaw('spks.project_id, COUNT(*) as aggregate')
                ->groupBy('spks.project_id')
                ->pluck('aggregate', 'spks.project_id'));

            $addCounts(FundRequest::query()
                ->whereIn('project_id', $projectIds)
                ->whereIn('status', ['PENDING_VERIFICATION', 'PENDING_APPROVAL', 'LPJ_SUBMITTED', 'LPJ_PENDING_APPROVAL'])
                ->selectRaw('project_id, COUNT(*) as aggregate')
                ->groupBy('project_id')
                ->pluck('aggregate', 'project_id'));
        }

        $projects->getCollection()->each(function (Project $project) use ($pendingCounts): void {
            $project->setAttribute('pending_approval_count', $pendingCounts[$project->id] ?? 0);
        });

        $projects->getCollection()->each(function (Project $project) use ($pendingRabCounts): void {
            $project->setAttribute('pending_rab_approval_count', (int) ($pendingRabCounts[$project->id] ?? 0));
        });

        return response()->json([
            'success' => true,
            'data' => $projects,
        ]);
    }

    public function show($id)
    {
        $project = Project::with(['rabBudgets' => function ($q) {
            $q->select('id', 'project_id', 'code_item', 'description', 'volume', 'unit_price', 'total_price', 'category', 'status', 'version')
                ->where('status', '!=', 'ARCHIVED')
                ->latest('version');
        }])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $project,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_name' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'start_date' => 'required|date',
        ]);

        $project = Project::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Proyek baru berhasil dibuat.',
            'data' => $project,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $project = Project::findOrFail($id);

        $validated = $request->validate([
            'project_name' => 'sometimes|required|string|max:255',
            'location' => 'sometimes|nullable|string|max:255',
            'start_date' => 'sometimes|nullable|date',
            'status' => 'sometimes|in:planning,active,completed,on_hold,cancelled',
        ]);

        $project->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil diperbarui.',
            'data' => $project->fresh(),
        ]);
    }

    public function destroy($id)
    {
        $project = Project::findOrFail($id);

        try {
            DB::transaction(function () use ($id, $project) {
                // Because SQLite cascading might not be fully active by default in all environments,
                // we will delete from dependent tables explicitly where necessary to avoid orphan data.

                // Delete invoice details
                if (Schema::hasTable('invoice_items')) {
                    DB::table('invoice_items')->whereIn('invoice_id', function ($q) use ($id) {
                        $q->select('id')->from('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                            $sq->select('id')->from('purchase_orders')->where('project_id', $id);
                        })->where('invoiceable_type', PurchaseOrder::class);
                    })->delete();

                    DB::table('invoice_items')->whereIn('invoice_id', function ($q) use ($id) {
                        $q->select('id')->from('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                            $sq->select('id')->from('spks')->where('project_id', $id);
                        })->where('invoiceable_type', Spk::class);
                    })->delete();
                }

                if (Schema::hasTable('invoices')) {
                    DB::table('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                        $sq->select('id')->from('purchase_orders')->where('project_id', $id);
                    })->where('invoiceable_type', PurchaseOrder::class)->delete();

                    DB::table('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                        $sq->select('id')->from('spks')->where('project_id', $id);
                    })->where('invoiceable_type', Spk::class)->delete();
                }

                if (Schema::hasTable('goods_receipt_items')) {
                    DB::table('goods_receipt_items')->whereIn('goods_receipt_id', function ($q) use ($id) {
                        $q->select('id')->from('goods_receipts')->whereIn('purchase_order_id', function ($sq) use ($id) {
                            $sq->select('id')->from('purchase_orders')->where('project_id', $id);
                        });
                    })->delete();
                }

                if (Schema::hasTable('goods_receipts')) {
                    DB::table('goods_receipts')->whereIn('purchase_order_id', function ($q) use ($id) {
                        $q->select('id')->from('purchase_orders')->where('project_id', $id);
                    })->delete();
                }

                // Delete SPK progress items before deleting SPKs
                if (Schema::hasTable('spk_progress')) {
                    DB::table('spk_progress')->whereIn('spk_id', function ($q) use ($id) {
                        $q->select('id')->from('spks')->where('project_id', $id);
                    })->delete();
                }

                // Delete BASTs via opnames -> spks -> project
                if (Schema::hasTable('basts')) {
                    DB::table('basts')->whereIn('opname_id', function ($q) use ($id) {
                        $q->select('id')->from('opnames')->whereIn('spk_id', function ($sq) use ($id) {
                            $sq->select('id')->from('spks')->where('project_id', $id);
                        });
                    })->delete();
                }

                // `po_items` is the actual table name. These rows use a required
                // foreign key to purchase_orders, so they must be removed before
                // the parent PO can be deleted.
                if (Schema::hasTable('po_items')) {
                    DB::table('po_items')->whereIn('purchase_order_id', function ($q) use ($id) {
                        $q->select('id')->from('purchase_orders')->where('project_id', $id);
                    })->delete();
                }
                if (Schema::hasTable('po_attachments')) {
                    DB::table('po_attachments')->whereIn('purchase_order_id', function ($q) use ($id) {
                        $q->select('id')->from('purchase_orders')->where('project_id', $id);
                    })->delete();
                }

                // Clear direct children of projects
                $tables = [
                    'purchase_requisitions',
                    'material_requests',
                    'efakturs',
                    'general_ledgers',
                    'rab_import_jobs',
                    'fund_requests',
                    'opnames',
                    'spks',
                    'purchase_orders',
                    'rab_budgets',
                ];

                foreach ($tables as $table) {
                    if (Schema::hasTable($table)) {
                        DB::table($table)->where('project_id', $id)->delete();
                    }
                }

                $project->delete();
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus proyek: '.$e->getMessage(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dihapus.',
        ]);
    }

    public function resetData($id)
    {
        $project = Project::findOrFail($id);

        if (Auth::user()?->role !== 'ADMIN') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya ADMIN yang dapat me-reset data proyek.',
            ], 403);
        }

        DB::transaction(function () use ($id) {
            // Because SQLite cascading might not be fully active by default in all environments,
            // we will delete from dependent tables explicitly where necessary to avoid orphan data.

            // Delete invoice details
            if (Schema::hasTable('invoice_items')) {
                DB::table('invoice_items')->whereIn('invoice_id', function ($q) use ($id) {
                    $q->select('id')->from('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                        $sq->select('id')->from('purchase_orders')->where('project_id', $id);
                    })->where('invoiceable_type', PurchaseOrder::class);
                })->delete();

                DB::table('invoice_items')->whereIn('invoice_id', function ($q) use ($id) {
                    $q->select('id')->from('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                        $sq->select('id')->from('spks')->where('project_id', $id);
                    })->where('invoiceable_type', Spk::class);
                })->delete();
            }

            if (Schema::hasTable('invoices')) {
                DB::table('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                    $sq->select('id')->from('purchase_orders')->where('project_id', $id);
                })->where('invoiceable_type', PurchaseOrder::class)->delete();

                DB::table('invoices')->whereIn('invoiceable_id', function ($sq) use ($id) {
                    $sq->select('id')->from('spks')->where('project_id', $id);
                })->where('invoiceable_type', Spk::class)->delete();
            }

            if (Schema::hasTable('goods_receipt_items')) {
                DB::table('goods_receipt_items')->whereIn('goods_receipt_id', function ($q) use ($id) {
                    $q->select('id')->from('goods_receipts')->whereIn('purchase_order_id', function ($sq) use ($id) {
                        $sq->select('id')->from('purchase_orders')->where('project_id', $id);
                    });
                })->delete();
            }

            if (Schema::hasTable('goods_receipts')) {
                DB::table('goods_receipts')->whereIn('purchase_order_id', function ($q) use ($id) {
                    $q->select('id')->from('purchase_orders')->where('project_id', $id);
                })->delete();
            }

            // Delete SPK progress items before deleting SPKs
            if (Schema::hasTable('spk_progress')) {
                DB::table('spk_progress')->whereIn('spk_id', function ($q) use ($id) {
                    $q->select('id')->from('spks')->where('project_id', $id);
                })->delete();
            }

            // Delete BASTs via opnames -> spks -> project
            if (Schema::hasTable('basts')) {
                DB::table('basts')->whereIn('opname_id', function ($q) use ($id) {
                    $q->select('id')->from('opnames')->whereIn('spk_id', function ($sq) use ($id) {
                        $sq->select('id')->from('spks')->where('project_id', $id);
                    });
                })->delete();
            }

            // `po_items` is the actual table name. These rows use a required
            // foreign key to purchase_orders, so they must be removed before
            // the parent PO can be reset.
            if (Schema::hasTable('po_items')) {
                DB::table('po_items')->whereIn('purchase_order_id', function ($q) use ($id) {
                    $q->select('id')->from('purchase_orders')->where('project_id', $id);
                })->delete();
            }
            if (Schema::hasTable('po_attachments')) {
                DB::table('po_attachments')->whereIn('purchase_order_id', function ($q) use ($id) {
                    $q->select('id')->from('purchase_orders')->where('project_id', $id);
                })->delete();
            }

            // Clear direct children of projects
            $tables = [
                'purchase_requisitions',
                'material_requests',
                'efakturs',
                'general_ledgers',
                'rab_import_jobs',
                'fund_requests',
                'opnames',
                'spks',
                'purchase_orders',
                'rab_budgets',
            ];

            foreach ($tables as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->where('project_id', $id)->delete();
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Data transaksi proyek berhasil di-reset.',
        ]);
    }
}
