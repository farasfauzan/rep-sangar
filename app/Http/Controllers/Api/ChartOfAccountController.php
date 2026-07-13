<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChartOfAccountController extends Controller
{
    /**
     * Display a listing of chart of accounts.
     */
    public function index(Request $request): JsonResponse
    {
        $query = ChartOfAccount::query()->with('parent');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $accounts = $query->orderBy('code')->paginate($request->integer('per_page', 50));

        return response()->json($accounts);
    }

    /**
     * Store a newly created chart of account.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50|unique:chart_of_accounts,code',
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:' . implode(',', ChartOfAccount::TYPES),
            'parent_id' => 'nullable|exists:chart_of_accounts,id',
            'is_active' => 'boolean',
        ]);

        $account = ChartOfAccount::create($validated);
        $account->load('parent');

        return response()->json([
            'message' => 'Account created successfully.',
            'account' => $account,
        ], 201);
    }

    /**
     * Display the specified chart of account.
     */
    public function show(int $id): JsonResponse
    {
        $account = ChartOfAccount::with(['parent', 'children'])->findOrFail($id);

        return response()->json($account);
    }

    /**
     * Update the specified chart of account.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::findOrFail($id);

        $validated = $request->validate([
            'code' => 'sometimes|string|max:50|unique:chart_of_accounts,code,' . $account->id,
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|string|in:' . implode(',', ChartOfAccount::TYPES),
            'parent_id' => 'nullable|exists:chart_of_accounts,id',
            'is_active' => 'boolean',
        ]);

        // Prevent setting parent to self or own child
        if (isset($validated['parent_id']) && $validated['parent_id'] === $account->id) {
            return response()->json(['message' => 'An account cannot be its own parent.'], 422);
        }

        $account->update($validated);
        $account->load('parent');

        return response()->json([
            'message' => 'Account updated successfully.',
            'account' => $account,
        ]);
    }

    /**
     * Remove the specified chart of account.
     */
    public function destroy(int $id): JsonResponse
    {
        $account = ChartOfAccount::findOrFail($id);

        // Check if account has children
        if ($account->children()->exists()) {
            return response()->json(['message' => 'Cannot delete account with child accounts. Remove children first.'], 422);
        }

        // Check if account is used in general ledger
        if (\App\Models\GeneralLedger::where('account_code', $account->code)->exists()) {
            return response()->json(['message' => 'Cannot delete account that has journal entries.'], 422);
        }

        $account->delete();

        return response()->json(['message' => 'Account deleted successfully.']);
    }
}
