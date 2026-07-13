<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * List users (paginated, searchable by name/email, filterable by role_id).
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with('role');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($roleId = $request->get('role_id')) {
            $query->where('role_id', $roleId);
        }

        return response()->json([
            'success' => true,
            'data'    => $query->orderBy('name')->paginate($request->get('per_page', 15)),
        ]);
    }

    /**
     * Get a single user with role relationship.
     */
    public function show(User $user): JsonResponse
    {
        $user->load('role');

        return response()->json([
            'success' => true,
            'data'    => $user,
        ]);
    }

    /**
     * Create a new user.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role_id'  => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);
        $user->load('role');

        return response()->json([
            'success' => true,
            'data'    => $user,
            'message' => 'User created successfully.',
        ], 201);
    }

    /**
     * Update an existing user.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name'     => ['sometimes', 'required', 'string', 'max:255'],
            'email'    => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'role_id'  => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);
        $user->load('role');

        return response()->json([
            'success' => true,
            'data'    => $user,
            'message' => 'User updated successfully.',
        ]);
    }

    /**
     * Soft-delete a user (prevent self-delete).
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete your own account.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully.',
        ]);
    }

    /**
     * Assign a role to a user (change role_id).
     */
    public function assignRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
        ]);

        $user->update(['role_id' => $validated['role_id']]);
        $user->load('role');

        return response()->json([
            'success' => true,
            'data'    => $user,
            'message' => 'Role assigned successfully.',
        ]);
    }
}
