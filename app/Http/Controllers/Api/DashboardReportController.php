<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FundRequest;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Models\Spk;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardReportController extends Controller
{
    /**
     * Executive summary across all projects.
     */
    public function executive(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');

        $projectQuery = Project::query();
        if ($projectId) {
            $projectQuery->where('id', $projectId);
        }
        $projectIds = $projectQuery->pluck('id');

        $totalBudget = (float) RabBudget::whereIn('project_id', $projectIds)
            ->where('status', '!=', RabBudget::STATUS_ARCHIVED)
            ->sum('total_price');

        $totalCommitment = (float) PurchaseOrder::whereIn('project_id', $projectIds)
            ->whereIn('status', ['APPROVED', 'COMPLETED'])
            ->sum('total_amount')
            + (float) Spk::whereIn('project_id', $projectIds)
                ->whereIn('status', ['APPROVED', 'COMPLETED'])
                ->sum('total_amount');

        $totalInvoiced = (float) Invoice::whereIn('status', ['APPROVED', 'PAID'])
            ->whereHasMorph('invoiceable', [PurchaseOrder::class, Spk::class], function ($query) use ($projectIds) {
                $query->whereIn('project_id', $projectIds);
            })->sum('amount');

        $totalPaid = (float) Transaction::whereHas('invoice', function ($query) use ($projectIds) {
            $query->whereHasMorph('invoiceable', [PurchaseOrder::class, Spk::class], function ($q) use ($projectIds) {
                $q->whereIn('project_id', $projectIds);
            });
        })->sum('transactions.amount');

        $totalFundRequests = (float) FundRequest::whereIn('project_id', $projectIds)
            ->where('status', '!=', 'REJECTED')
            ->sum('amount');

        $projectCount = $projectQuery->count();
        $rabItemCount = RabBudget::whereIn('project_id', $projectIds)
            ->where('status', '!=', RabBudget::STATUS_ARCHIVED)
            ->count();
        $pendingApprovals = RabBudget::whereIn('project_id', $projectIds)
            ->where('status', RabBudget::STATUS_PENDING)
            ->count()
            + PurchaseOrder::whereIn('project_id', $projectIds)->where('status', 'PENDING_APPROVAL')->count()
            + Spk::whereIn('project_id', $projectIds)->where('status', 'PENDING_APPROVAL')->count()
            + FundRequest::whereIn('project_id', $projectIds)->where('status', 'PENDING_APPROVAL')->count();

        $projectStatus = Project::select('status', DB::raw('COUNT(*) as count'))
            ->when($projectId, fn ($q) => $q->where('id', $projectId))
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => ['status' => $row->status, 'count' => $row->count])
            ->toArray();

        $categoryBreakdown = RabBudget::whereIn('project_id', $projectIds)
            ->where('status', '!=', RabBudget::STATUS_ARCHIVED)
            ->selectRaw('category, COUNT(*) as item_count, SUM(total_price) as subtotal')
            ->groupBy('category')
            ->orderByDesc('subtotal')
            ->get()
            ->map(fn ($row) => [
                'category_name' => $row->category ?: 'Umum',
                'count' => $row->item_count,
                'total' => (float) $row->subtotal,
            ])
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'total_budget' => $totalBudget,
                'total_commitment' => $totalCommitment,
                'total_invoiced' => $totalInvoiced,
                'total_paid' => $totalPaid,
                'total_fund_requests' => $totalFundRequests,
                'project_count' => $projectCount,
                'rab_item_count' => $rabItemCount,
                'pending_approvals' => $pendingApprovals,
                'project_status' => $projectStatus,
                'by_category' => $categoryBreakdown,
            ],
        ]);
    }

    /**
     * Financial report: cashflow and budget realization.
     */
    public function financial(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');
        $range = $request->query('range', 'year'); // month | quarter | year
        $projectQuery = Project::query();
        if ($projectId) {
            $projectQuery->where('id', $projectId);
        }
        $projectIds = $projectQuery->pluck('id');

        $totalBudget = (float) RabBudget::whereIn('project_id', $projectIds)
            ->where('status', '!=', RabBudget::STATUS_ARCHIVED)
            ->sum('total_price');

        $totalCommitment = (float) PurchaseOrder::whereIn('project_id', $projectIds)
            ->whereIn('status', ['APPROVED', 'COMPLETED'])
            ->sum('total_amount')
            + (float) Spk::whereIn('project_id', $projectIds)
                ->whereIn('status', ['APPROVED', 'COMPLETED'])
                ->sum('total_amount');

        $totalPaid = (float) Transaction::whereHas('invoice', function ($query) use ($projectIds) {
            $query->whereHasMorph('invoiceable', [PurchaseOrder::class, Spk::class], function ($q) use ($projectIds) {
                $q->whereIn('project_id', $projectIds);
            });
        })->sum('transactions.amount');

        $fundRequested = (float) FundRequest::whereIn('project_id', $projectIds)
            ->where('status', '!=', 'REJECTED')
            ->sum('amount');
        $fundPaid = (float) FundRequest::whereIn('project_id', $projectIds)
            ->whereNotNull('paid_at')
            ->sum('amount');

        $cashflow = $this->buildCashflow($projectIds, $range);

        $realization = [
            'budget' => $totalBudget,
            'committed' => $totalCommitment,
            'paid' => $totalPaid,
            'remaining_budget' => max(0, $totalBudget - $totalCommitment),
            'realization_percentage' => $totalBudget > 0 ? round(($totalPaid / $totalBudget) * 100, 2) : 0,
            'commitment_percentage' => $totalBudget > 0 ? round(($totalCommitment / $totalBudget) * 100, 2) : 0,
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $realization,
                'fund_request' => [
                    'requested' => $fundRequested,
                    'paid' => $fundPaid,
                ],
                'cashflow' => $cashflow,
            ],
        ]);
    }

    /**
     * Project progress report and RAB comparison.
     */
    public function projects(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');
        $perPage = (int) $request->query('per_page', 15);

        $projects = Project::query()
            ->when($projectId, fn ($q) => $q->where('id', $projectId))
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        $data = $projects->getCollection()->map(function (Project $project) {
            $budget = (float) RabBudget::where('project_id', $project->id)
                ->where('status', '!=', RabBudget::STATUS_ARCHIVED)
                ->sum('total_price');

            $commitment = (float) PurchaseOrder::where('project_id', $project->id)
                ->whereIn('status', ['APPROVED', 'COMPLETED'])
                ->sum('total_amount')
                + (float) Spk::where('project_id', $project->id)
                    ->whereIn('status', ['APPROVED', 'COMPLETED'])
                    ->sum('total_amount');

            $paid = (float) Transaction::whereHas('invoice', function ($query) use ($project) {
                $query->whereHasMorph('invoiceable', [PurchaseOrder::class, Spk::class], function ($q) use ($project) {
                    $q->where('project_id', $project->id);
                });
            })->sum('transactions.amount');

            $spkProgress = Spk::where('project_id', $project->id)
                ->where('status', 'COMPLETED')
                ->count();
            $spkTotal = max(1, Spk::where('project_id', $project->id)->count());
            $spkCompletionRate = round(($spkProgress / $spkTotal) * 100, 2);

            $avgOpnameProgress = (float) DB::table('opnames')
                ->join('spks', 'opnames.spk_id', '=', 'spks.id')
                ->where('spks.project_id', $project->id)
                ->where('opnames.status', 'APPROVED')
                ->avg('opnames.progress_percentage') ?? 0;

            $overallProgress = min(100, round((($spkCompletionRate * 0.4) + ($avgOpnameProgress * 0.6)), 2));

            $categoryBreakdown = RabBudget::where('project_id', $project->id)
                ->where('status', '!=', RabBudget::STATUS_ARCHIVED)
                ->selectRaw('category, COUNT(*) as item_count, SUM(total_price) as subtotal')
                ->groupBy('category')
                ->orderByDesc('subtotal')
                ->get()
                ->map(fn ($row) => [
                    'category_name' => $row->category ?: 'Umum',
                    'count' => $row->item_count,
                    'total' => (float) $row->subtotal,
                ])
                ->toArray();

            return [
                'id' => $project->id,
                'project_name' => $project->project_name,
                'location' => $project->location,
                'start_date' => $project->start_date,
                'status' => $project->status,
                'budget' => $budget,
                'commitment' => $commitment,
                'paid' => $paid,
                'remaining_budget' => max(0, $budget - $commitment),
                'realization_percentage' => $budget > 0 ? round(($paid / $budget) * 100, 2) : 0,
                'commitment_percentage' => $budget > 0 ? round(($commitment / $budget) * 100, 2) : 0,
                'progress_percentage' => $overallProgress,
                'by_category' => $categoryBreakdown,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ],
        ]);
    }

    /**
     * Build monthly / quarterly cashflow data.
     *
     * @param \Illuminate\Support\Collection<int> $projectIds
     */
    private function buildCashflow($projectIds, string $range): array
    {
        $format = match ($range) {
            'month' => '%Y-%m-%d',
            'quarter' => '%Y-%m',
            default => '%Y-%m',
        };

        $dateColumn = "DATE_FORMAT(payment_date, '{$format}')";
        $paid = Transaction::whereHas('invoice', function ($query) use ($projectIds) {
            $query->whereHasMorph('invoiceable', [PurchaseOrder::class, Spk::class], function ($q) use ($projectIds) {
                $q->whereIn('project_id', $projectIds);
            });
        })
            ->selectRaw("{$dateColumn} as period, SUM(amount) as amount")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->map(fn ($row) => ['period' => $row->period, 'amount' => (float) $row->amount])
            ->keyBy('period');

        $commitments = collect();
        foreach ([PurchaseOrder::class => 'date', Spk::class => 'created_at'] as $model => $dateField) {
            $rows = $model::whereIn('project_id', $projectIds)
                ->whereIn('status', ['APPROVED', 'COMPLETED'])
                ->selectRaw("DATE_FORMAT({$dateField}, '{$format}') as period, SUM(total_amount) as amount")
                ->groupBy('period')
                ->orderBy('period')
                ->get();

            foreach ($rows as $row) {
                $existing = $commitments->get($row->period, 0);
                $commitments->put($row->period, $existing + (float) $row->amount);
            }
        }

        // Fill empty periods for the last 12 months / 4 quarters / 1 year.
        $now = Carbon::now();
        $periods = collect();
        if ($range === 'month') {
            for ($i = 29; $i >= 0; $i--) {
                $periods->push($now->clone()->subDays($i)->format('Y-m-d'));
            }
        } elseif ($range === 'quarter') {
            for ($i = 11; $i >= 0; $i--) {
                $periods->push($now->clone()->subMonthsNoOverflow($i)->format('Y-m'));
            }
        } else {
            for ($i = 4; $i >= 0; $i--) {
                $periods->push($now->clone()->subMonthsNoOverflow($i * 3)->format('Y-m'));
            }
        }

        return $periods->map(function (string $period) use ($paid, $commitments) {
            return [
                'period' => $period,
                'paid' => $paid->get($period)['amount'] ?? 0,
                'committed' => $commitments->get($period, 0),
            ];
        })->values()->toArray();
    }
}
