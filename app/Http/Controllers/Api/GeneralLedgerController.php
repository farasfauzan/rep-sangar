<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class GeneralLedgerController extends Controller
{
    /**
     * List journal entries (paginated, filterable by date range and account_code).
     */
    public function index(Request $request): JsonResponse
    {
        $query = GeneralLedger::query()
            ->with(['creator', 'chartOfAccount'])
            ->orderByDesc('transaction_date')
            ->orderByDesc('journal_number');

        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->input('date_to'));
        }

        if ($request->filled('account_code')) {
            $query->where('account_code', $request->input('account_code'));
        }

        $entries = $query->paginate($request->integer('per_page', 25));

        return response()->json($entries);
    }

    /**
     * Show all journal lines for a given journal_number.
     */
    public function show(string $journal_number): JsonResponse
    {
        $entries = GeneralLedger::with(['creator', 'chartOfAccount'])
            ->where('journal_number', $journal_number)
            ->get();

        if ($entries->isEmpty()) {
            return response()->json(['message' => 'Journal not found.'], 404);
        }

        $totalDebit = $entries->sum('debit');
        $totalCredit = $entries->sum('credit');

        return response()->json([
            'journal_number' => $journal_number,
            'transaction_date' => $entries->first()->transaction_date,
            'description' => $entries->first()->description,
            'entries' => $entries,
            'total_debit' => (float) $totalDebit,
            'total_credit' => (float) $totalCredit,
            'is_balanced' => bccomp((string) $totalDebit, (string) $totalCredit, 2) === 0,
        ]);
    }

    /**
     * Create a new journal entry with double-entry validation.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'transaction_date' => 'required|date',
            'description' => 'nullable|string|max:1000',
            'project_id' => 'nullable|exists:projects,id',
            'reference_type' => 'nullable|string|max:255',
            'reference_id' => 'nullable|integer',
            'entries' => 'required|array|min:2',
            'entries.*.account_code' => 'required|string|exists:chart_of_accounts,code',
            'entries.*.debit' => 'required|numeric|min:0',
            'entries.*.credit' => 'required|numeric|min:0',
        ]);

        $totalDebit = 0;
        $totalCredit = 0;

        foreach ($validated['entries'] as $entry) {
            $totalDebit += (float) $entry['debit'];
            $totalCredit += (float) $entry['credit'];
        }

        // Double-entry: total debit must equal total credit
        if (bccomp(number_format($totalDebit, 2, '.', ''), number_format($totalCredit, 2, '.', ''), 2) !== 0) {
            throw ValidationException::withMessages([
                'entries' => [
                    "Total debit ({$totalDebit}) must equal total credit ({$totalCredit}). Double-entry accounting requires balanced entries.",
                ],
            ]);
        }

        $journalNumber = $this->generateJournalNumber($validated['transaction_date']);

        $journalEntries = DB::transaction(function () use ($validated, $journalNumber) {
            $entries = [];
            foreach ($validated['entries'] as $entry) {
                $entries[] = GeneralLedger::create([
                    'journal_number' => $journalNumber,
                    'transaction_date' => $validated['transaction_date'],
                    'account_code' => $entry['account_code'],
                    'debit' => $entry['debit'],
                    'credit' => $entry['credit'],
                    'description' => $validated['description'] ?? null,
                    'reference_type' => $validated['reference_type'] ?? null,
                    'reference_id' => $validated['reference_id'] ?? null,
                    'project_id' => $validated['project_id'] ?? null,
                    'created_by' => Auth::id(),
                ]);
            }
            return $entries;
        });

        return response()->json([
            'message' => 'Journal entry created successfully.',
            'journal_number' => $journalNumber,
            'entries' => $journalEntries,
        ], 201);
    }

    /**
     * Trial Balance — return account balances (debit - credit per account).
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $query = GeneralLedger::select(
            'account_code',
            DB::raw('SUM(debit) as total_debit'),
            DB::raw('SUM(credit) as total_credit'),
            DB::raw('SUM(debit) - SUM(credit) as balance')
        )
            ->groupBy('account_code')
            ->orderBy('account_code');

        if ($request->filled('date_from')) {
            $query->where('transaction_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('transaction_date', '<=', $request->input('date_to'));
        }

        $balances = $query->get()->map(function ($row) {
            $coa = ChartOfAccount::where('code', $row->account_code)->first();
            return [
                'account_code' => $row->account_code,
                'account_name' => $coa?->name,
                'account_type' => $coa?->type,
                'total_debit' => (float) $row->total_debit,
                'total_credit' => (float) $row->total_credit,
                'balance' => (float) $row->balance,
            ];
        });

        $totalDebit = $balances->sum('total_debit');
        $totalCredit = $balances->sum('total_credit');

        return response()->json([
            'trial_balance' => $balances,
            'total_debit' => $totalDebit,
            'total_credit' => $totalCredit,
            'is_balanced' => bccomp(number_format($totalDebit, 2, '.', ''), number_format($totalCredit, 2, '.', ''), 2) === 0,
        ]);
    }

    /**
     * Generate sequential journal number: JRN-YYYYMMDD-NNNN.
     */
    private function generateJournalNumber(string $date): string
    {
        $datePart = date('Ymd', strtotime($date));
        $prefix = "JRN-{$datePart}-";

        $lastNumber = GeneralLedger::where('journal_number', 'like', $prefix . '%')
            ->orderByDesc('journal_number')
            ->value('journal_number');

        if ($lastNumber) {
            $seq = (int) substr($lastNumber, strlen($prefix)) + 1;
        } else {
            $seq = 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }
}
