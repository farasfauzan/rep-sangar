<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

class RoleController extends Controller
{
    /**
     * List all roles.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => Role::orderBy('role_name')->get(),
        ]);
    }
}
