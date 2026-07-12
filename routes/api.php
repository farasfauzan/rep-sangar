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

Route::middleware(['auth:web', 'verified'])->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Workflow C: Goods Receipt & Opname
    Route::get('/goods-receipts', [GoodsReceiptController::class, 'index']);
    Route::get('/pos/{poId}/goods-receipts', [GoodsReceiptController::class, 'getByPo']);
    Route::post('/goods-receipts', [GoodsReceiptController::class, 'store']);
    Route::get('/opnames', [OpnameController::class, 'index']);
    Route::post('/opnames', [OpnameController::class, 'store']);
    Route::put('/opnames/{id}/approve', [OpnameController::class, 'approve']);
    Route::put('/opnames/{id}/reject', [OpnameController::class, 'reject']);

    // Workflow C: Invoices
    Route::get('/invoices', [InvoiceController::class, 'index']);
    Route::post('/invoices', [InvoiceController::class, 'store']);
    Route::put('/invoices/{id}/engineer-verify', [InvoiceController::class, 'verifyEngineer']);
    Route::put('/invoices/{id}/finance-verify', [InvoiceController::class, 'verifyFinance']);
    Route::put('/invoices/{id}/manager-approve', [InvoiceController::class, 'approveManager']);
    Route::post('/invoices/{id}/payments', [InvoiceController::class, 'executePayment']);

    // RAB Data
    Route::post('/rab/preview', [RabBudgetController::class, 'preview']);
    Route::post('/rab/auto-import', [RabBudgetController::class, 'autoImport']);
    Route::get('/rab', [RabBudgetController::class, 'index']);
    Route::get('/rab/summary', [RabBudgetController::class, 'summary']);
    Route::get('/rab/{id}', [RabBudgetController::class, 'show']);
    Route::put('/rab/{id}', [RabBudgetController::class, 'update']);
    Route::delete('/rab/{id}', [RabBudgetController::class, 'destroy']);

    // RAB Approval Workflow
    Route::post('/rab/submit-for-approval', [RabBudgetController::class, 'submitForApproval']);
    Route::post('/rab/approve', [RabBudgetController::class, 'approve']);
    Route::post('/rab/reject', [RabBudgetController::class, 'reject']);
    Route::get('/rab/rollup', [RabBudgetController::class, 'rollUp']);

    // Purchase Requisitions (PR)
    Route::get('/purchase-requisitions', [PurchaseRequisitionController::class, 'index']);
    Route::post('/purchase-requisitions', [PurchaseRequisitionController::class, 'store']);
    Route::get('/purchase-requisitions/{id}', [PurchaseRequisitionController::class, 'show']);
    Route::put('/purchase-requisitions/{id}/approve', [PurchaseRequisitionController::class, 'approve']);
    Route::put('/purchase-requisitions/{id}/reject', [PurchaseRequisitionController::class, 'reject']);

    // Workflow A: Pengadaan & Kontrak
    Route::get('/pos', [PurchaseOrderController::class, 'index']);
    Route::post('/pos', [PurchaseOrderController::class, 'store']);
    Route::put('/pos/{id}/submit', [PurchaseOrderController::class, 'submit']);
    Route::put('/pos/{id}/approve', [PurchaseOrderController::class, 'approve']);
    Route::put('/pos/{id}/reject', [PurchaseOrderController::class, 'reject']);
    Route::get('/spks', [SpkController::class, 'index']);
    Route::post('/spks', [SpkController::class, 'store']);
    Route::put('/spks/{id}/submit', [SpkController::class, 'submit']);
    Route::put('/spks/{id}/approve', [SpkController::class, 'approve']);
    Route::put('/spks/{id}/reject', [SpkController::class, 'reject']);

    // Workflow D: LPJ & Permohonan Dana
    Route::get('/fund-requests', [FundRequestController::class, 'index']);
    Route::post('/fund-requests', [FundRequestController::class, 'store']);
    Route::put('/fund-requests/{id}/approve', [FundRequestController::class, 'approve']);
    Route::put('/fund-requests/{id}/reject', [FundRequestController::class, 'reject']);
    Route::post('/fund-requests/{id}/payments', [FundRequestController::class, 'pay']);
    Route::put('/fund-requests/{id}/lpj', [FundRequestController::class, 'submitLpj']);
    Route::put('/fund-requests/{id}/lpj-verify', [FundRequestController::class, 'verifyLpj']);

    // Master Data
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{id}', [ProjectController::class, 'show']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::put('/projects/{id}', [ProjectController::class, 'update']);
    Route::patch('/projects/{id}', [ProjectController::class, 'update']);

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::post('/inventory/receive', [InventoryController::class, 'receive']);

    // Audit Trail
    Route::get('/audit-logs', [AuditLogController::class, 'index']);

    // Dashboard & Reports
    Route::get('/dashboard/executive', [DashboardReportController::class, 'executive']);
    Route::get('/dashboard/financial', [DashboardReportController::class, 'financial']);
    Route::get('/dashboard/projects', [DashboardReportController::class, 'projects']);
});
