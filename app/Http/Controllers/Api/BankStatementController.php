<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankStatement;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BankStatementController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            BankStatement::with('transaction.invoice', 'transaction.fundRequest')
                ->latest('transaction_date')
                ->paginate(min($request->integer('per_page', 25), 100))
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->rules());
        $statement = BankStatement::create($validated + ['created_by' => $request->user()->id]);

        return response()->json(['message' => 'Mutasi rekening disimpan.', 'data' => $statement], 201);
    }

    public function uploadCsv(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:10240']);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = array_map(fn ($value) => strtolower(trim(str_replace(' ', '_', $value))), fgetcsv($handle) ?: []);
        $required = ['transaction_date', 'bank_name', 'debit', 'credit'];
        if (array_diff($required, $header)) {
            fclose($handle);
            return response()->json(['message' => 'Kolom CSV wajib: transaction_date, bank_name, debit, credit.'], 422);
        }

        $count = DB::transaction(function () use ($handle, $header, $request) {
            $count = 0;
            while (($row = fgetcsv($handle)) !== false) {
                $data = array_combine($header, $row);
                if (! $data) {
                    continue;
                }
                BankStatement::updateOrCreate(
                    ['reference_number' => $data['reference_number'] ?: null, 'transaction_date' => $data['transaction_date']],
                    [
                        'bank_name' => $data['bank_name'],
                        'account_number' => $data['account_number'] ?? null,
                        'description' => $data['description'] ?? null,
                        'debit' => (float) ($data['debit'] ?: 0),
                        'credit' => (float) ($data['credit'] ?: 0),
                        'created_by' => $request->user()->id,
                    ]
                );
                $count++;
            }

            return $count;
        });
        fclose($handle);

        return response()->json(['message' => "{$count} mutasi rekening diimpor."]);
    }

    public function match(Request $request, $id)
    {
        $validated = $request->validate(['transaction_id' => 'required|exists:transactions,id']);
        $statement = BankStatement::findOrFail($id);
        $transaction = Transaction::findOrFail($validated['transaction_id']);
        $statementAmount = max((float) $statement->debit, (float) $statement->credit);
        if (abs($statementAmount - (float) $transaction->amount) > 0.01) {
            return response()->json(['message' => 'Nilai mutasi tidak sama dengan nilai transaksi.'], 422);
        }
        $statement->update(['transaction_id' => $transaction->id, 'status' => 'MATCHED']);

        return response()->json(['message' => 'Mutasi rekening berhasil direkonsiliasi.', 'data' => $statement]);
    }

    private function rules(): array
    {
        return [
            'transaction_date' => 'required|date',
            'bank_name' => 'required|string|max:255',
            'account_number' => 'nullable|string|max:100',
            'reference_number' => 'nullable|string|max:255|unique:bank_statements,reference_number',
            'description' => 'nullable|string|max:1000',
            'debit' => 'required|numeric|min:0',
            'credit' => 'required|numeric|min:0',
        ];
    }
}
