<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\GoodsReceiptController;
use App\Http\Controllers\Api\OpnameController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\RabBudgetController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\SpkController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\FundRequestController;
use App\Http\Controllers\Api\PurchaseRequisitionController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\DashboardReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\GeneralLedgerController;
use App\Http\Controllers\Api\ChartOfAccountController;
use App\Http\Controllers\Api\TaxController;

Route::middleware(['auth:web', 'verified'])->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // =====================================================
    // Projects — all roles can view, ADMIN/MGR_KOMERSIAL CRUD
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/{id}', [ProjectController::class, 'show']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::put('/projects/{id}', [ProjectController::class, 'update']);
        Route::patch('/projects/{id}', [ProjectController::class, 'update']);
    });

    // =====================================================
    // RAB Data — all can view, ADMIN/ENGINEER import/approve
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/rab', [RabBudgetController::class, 'index']);
        Route::get('/rab/summary', [RabBudgetController::class, 'summary']);
        Route::get('/rab/{id}', [RabBudgetController::class, 'show']);
        Route::get('/rab/rollup', [RabBudgetController::class, 'rollUp']);
    });
    Route::middleware('role:ADMIN,ENGINEER')->group(function () {
        Route::post('/rab/preview', [RabBudgetController::class, 'preview']);
        Route::post('/rab/auto-import', [RabBudgetController::class, 'autoImport']);
        Route::put('/rab/{id}', [RabBudgetController::class, 'update']);
        Route::delete('/rab/{id}', [RabBudgetController::class, 'destroy']);
        Route::post('/rab/submit-for-approval', [RabBudgetController::class, 'submitForApproval']);
        Route::post('/rab/approve', [RabBudgetController::class, 'approve']);
        Route::post('/rab/reject', [RabBudgetController::class, 'reject']);
    });

    // =====================================================
    // Purchase Requisitions — all can create/view, ADMIN/MGR_KOMERSIAL approve
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/purchase-requisitions', [PurchaseRequisitionController::class, 'index']);
        Route::post('/purchase-requisitions', [PurchaseRequisitionController::class, 'store']);
        Route::get('/purchase-requisitions/{id}', [PurchaseRequisitionController::class, 'show']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/purchase-requisitions/{id}/approve', [PurchaseRequisitionController::class, 'approve']);
        Route::put('/purchase-requisitions/{id}/reject', [PurchaseRequisitionController::class, 'reject']);
    });

    // =====================================================
    // Purchase Orders — ADMIN/PURCHASING_LEGAL create/update, ADMIN/MGR_KOMERSIAL approve/reject
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/pos', [PurchaseOrderController::class, 'index']);
    });
    Route::middleware('role:ADMIN,PURCHASING_LEGAL')->group(function () {
        Route::post('/pos', [PurchaseOrderController::class, 'store']);
        Route::put('/pos/{id}/submit', [PurchaseOrderController::class, 'submit']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/pos/{id}/approve', [PurchaseOrderController::class, 'approve']);
        Route::put('/pos/{id}/reject', [PurchaseOrderController::class, 'reject']);
    });

    // =====================================================
    // SPK — ADMIN/PURCHASING_LEGAL create/update, ADMIN/MGR_KOMERSIAL approve/reject
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/spks', [SpkController::class, 'index']);
    });
    Route::middleware('role:ADMIN,PURCHASING_LEGAL')->group(function () {
        Route::post('/spks', [SpkController::class, 'store']);
        Route::put('/spks/{id}/submit', [SpkController::class, 'submit']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/spks/{id}/approve', [SpkController::class, 'approve']);
        Route::put('/spks/{id}/reject', [SpkController::class, 'reject']);
    });

    // =====================================================
    // Invoices — ADMIN/ENGINEER verify, ADMIN/VERIFIKATOR_KEU finance verify, ADMIN/MGR_KOMERSIAL approve
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store']);
    });
    Route::middleware('role:ADMIN,ENGINEER')->group(function () {
        Route::put('/invoices/{id}/engineer-verify', [InvoiceController::class, 'verifyEngineer']);
    });
    Route::middleware('role:ADMIN,VERIFIKATOR_KEU')->group(function () {
        Route::put('/invoices/{id}/finance-verify', [InvoiceController::class, 'verifyFinance']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/invoices/{id}/manager-approve', [InvoiceController::class, 'approveManager']);
    });
    Route::middleware('role:ADMIN,VERIFIKATOR_KEU,KEU_KANTOR')->group(function () {
        Route::post('/invoices/{id}/payments', [InvoiceController::class, 'executePayment']);
    });

    // =====================================================
    // Fund Requests — all can create, ADMIN/KEU_KANTOR approve
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/fund-requests', [FundRequestController::class, 'index']);
        Route::post('/fund-requests', [FundRequestController::class, 'store']);
        Route::put('/fund-requests/{id}/lpj', [FundRequestController::class, 'submitLpj']);
    });
    Route::middleware('role:ADMIN,KEU_KANTOR')->group(function () {
        Route::put('/fund-requests/{id}/approve', [FundRequestController::class, 'approve']);
        Route::put('/fund-requests/{id}/reject', [FundRequestController::class, 'reject']);
        Route::post('/fund-requests/{id}/payments', [FundRequestController::class, 'pay']);
        Route::put('/fund-requests/{id}/lpj-verify', [FundRequestController::class, 'verifyLpj']);
    });

    // =====================================================
    // Goods Receipt — ADMIN/LAPANGAN/PURCHASING_LEGAL can receive
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,PURCHASING_LEGAL')->group(function () {
        Route::get('/goods-receipts', [GoodsReceiptController::class, 'index']);
        Route::get('/pos/{poId}/goods-receipts', [GoodsReceiptController::class, 'getByPo']);
        Route::post('/goods-receipts', [GoodsReceiptController::class, 'store']);
    });

    // =====================================================
    // Opname — ADMIN/LAPANGAN can create, ADMIN/ENGINEER approve
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN')->group(function () {
        Route::get('/opnames', [OpnameController::class, 'index']);
        Route::post('/opnames', [OpnameController::class, 'store']);
    });
    Route::middleware('role:ADMIN,ENGINEER')->group(function () {
        Route::put('/opnames/{id}/approve', [OpnameController::class, 'approve']);
        Route::put('/opnames/{id}/reject', [OpnameController::class, 'reject']);
    });

    // =====================================================
    // Inventory — all can view
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::get('/inventory/{stock}/movements', [InventoryController::class, 'movements']);
    });
    Route::middleware('role:ADMIN,LAPANGAN,PURCHASING_LEGAL')->group(function () {
        Route::post('/inventory/receive', [InventoryController::class, 'receive']);
    });
    Route::middleware('role:ADMIN,LAPANGAN')->group(function () {
        Route::post('/inventory/{stock}/adjust', [InventoryController::class, 'adjust']);
    });

    // =====================================================
    // Audit Logs — ADMIN only
    // =====================================================
    Route::middleware('role:ADMIN')->group(function () {
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });

    // =====================================================
    // Suppliers — all can view, ADMIN/PURCHASING_LEGAL CRUD
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/suppliers', [SupplierController::class, 'index']);
        Route::get('/suppliers/{id}', [SupplierController::class, 'show']);
    });
    Route::middleware('role:ADMIN,PURCHASING_LEGAL')->group(function () {
        Route::post('/suppliers', [SupplierController::class, 'store']);
        Route::put('/suppliers/{id}', [SupplierController::class, 'update']);
        Route::patch('/suppliers/{id}', [SupplierController::class, 'update']);
        Route::delete('/suppliers/{id}', [SupplierController::class, 'destroy']);
    });

    // =====================================================
    // General Ledger — ADMIN/ACCOUNTING write, all can read
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/general-ledger', [GeneralLedgerController::class, 'index']);
        Route::get('/general-ledger/trial-balance', [GeneralLedgerController::class, 'trialBalance']);
        Route::get('/general-ledger/{journal_number}', [GeneralLedgerController::class, 'show']);
    });
    Route::middleware('role:ADMIN,ACCOUNTING')->group(function () {
        Route::post('/general-ledger', [GeneralLedgerController::class, 'store']);
    });

    // =====================================================
    // Chart of Accounts — ADMIN/ACCOUNTING CRUD
    // =====================================================
    Route::middleware('role:ADMIN,ACCOUNTING')->group(function () {
        Route::get('/chart-of-accounts', [ChartOfAccountController::class, 'index']);
        Route::post('/chart-of-accounts', [ChartOfAccountController::class, 'store']);
        Route::get('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'show']);
        Route::put('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'update']);
        Route::patch('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'update']);
        Route::delete('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'destroy']);
    });

    // =====================================================
    // Dashboard — all authenticated
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/dashboard/executive', [DashboardReportController::class, 'executive']);
        Route::get('/dashboard/financial', [DashboardReportController::class, 'financial']);
        Route::get('/dashboard/projects', [DashboardReportController::class, 'projects']);
    });

    // =====================================================
    // Taxes — all authenticated can view/calculate, ADMIN/PAJAK CRUD
    // =====================================================
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/taxes', [TaxController::class, 'index']);
        Route::get('/taxes/{id}', [TaxController::class, 'show']);
        Route::post('/taxes/calculate', [TaxController::class, 'calculate']);
    });
    Route::middleware('role:ADMIN,PAJAK')->group(function () {
        Route::post('/taxes', [TaxController::class, 'store']);
        Route::put('/taxes/{id}', [TaxController::class, 'update']);
        Route::patch('/taxes/{id}', [TaxController::class, 'update']);
        Route::delete('/taxes/{id}', [TaxController::class, 'destroy']);
    });

    // =====================================================
    // User Management — ADMIN only
    // =====================================================
    Route::middleware('role:ADMIN')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::put('users/{user}/role', [UserController::class, 'assignRole']);
        Route::get('roles', [RoleController::class, 'index']);
    });
});
