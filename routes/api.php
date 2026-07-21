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
use App\Http\Controllers\Api\FundReceiptController;
use App\Http\Controllers\Api\BastController;
use App\Http\Controllers\Api\TaxController;
use App\Http\Controllers\Api\EfakturController;
use App\Http\Controllers\Api\FinancialReportController;
use App\Http\Controllers\Api\RabImportController;
use App\Http\Controllers\Api\BankStatementController;
use App\Http\Controllers\Api\WorkflowNotificationController;

Route::middleware(['auth:web', 'verified'])->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/notifications', [WorkflowNotificationController::class, 'index']);
    Route::put('/notifications/read-all', [WorkflowNotificationController::class, 'markAllRead']);
    Route::put('/notifications/{id}/read', [WorkflowNotificationController::class, 'markRead']);

    // ─── Projects ──────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/{id}', [ProjectController::class, 'show']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::put('/projects/{id}', [ProjectController::class, 'update']);
        Route::patch('/projects/{id}', [ProjectController::class, 'update']);
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);
        Route::post('/projects/{id}/reset', [ProjectController::class, 'resetData']);
    });

    // ─── RAB Import ────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,ENGINEER,MGR_KOMERSIAL')->group(function () {
        Route::post('/rab/import/upload', [RabImportController::class, 'upload']);
        Route::post('/rab/import/preview', [RabImportController::class, 'preview']);
        Route::post('/rab/import/validate', [RabImportController::class, 'validateImport']);
        Route::post('/rab/import', [RabImportController::class, 'import']);
        Route::post('/rab/import/auto', [RabImportController::class, 'autoImport']);
        Route::post('/rab/import/manual', [RabImportController::class, 'manualImport']);
        Route::post('/rab/import/manual-item', [RabImportController::class, 'manualImportItem']);
        Route::post('/rab/import/manual-status', [RabImportController::class, 'manualImportStatus']);
        Route::post('/rab/import/draft-rows', [RabImportController::class, 'storeDraftRows']);
        Route::patch('/rab/import/draft-row', [RabImportController::class, 'updateDraftRow']);
        Route::get('/rab/import/drafts', [RabImportController::class, 'drafts']);
        Route::get('/rab/import/drafts/{fingerprint}', [RabImportController::class, 'draftRows']);
        Route::get('/rab/import/projects', [RabImportController::class, 'projects']);
    });

    // ─── RAB Budgets ──────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/rab', [RabBudgetController::class, 'index']);
        Route::get('/rab/summary', [RabBudgetController::class, 'summary']);
        Route::get('/rab/{id}', [RabBudgetController::class, 'show']);
        Route::get('/rab/rollup', [RabBudgetController::class, 'rollUp']);
        Route::get('/rab/export', [RabBudgetController::class, 'export']);
    });
    Route::middleware('role:ADMIN,ENGINEER,MGR_KOMERSIAL')->group(function () {
        Route::put('/rab/{id}', [RabBudgetController::class, 'update']);
        Route::patch('/rab/{id}', [RabBudgetController::class, 'update']);
        Route::delete('/rab/{id}', [RabBudgetController::class, 'destroy']);
        Route::post('/rab/auto-import', [RabBudgetController::class, 'autoImport']);
    });

    // ─── Purchase Orders ───────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/pos', [PurchaseOrderController::class, 'index']);
        Route::get('/pos/{id}', [PurchaseOrderController::class, 'show']);
        Route::get('/purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
    });
    Route::middleware('role:ADMIN,LAPANGAN,PURCHASING_LEGAL')->group(function () {
        Route::post('/pos', [PurchaseOrderController::class, 'store']);
        Route::put('/pos/{id}', [PurchaseOrderController::class, 'update']);
        Route::put('/purchase-orders/{id}', [PurchaseOrderController::class, 'update']);
    });
    Route::middleware('role:ADMIN,PURCHASING_LEGAL')->group(function () {
        Route::put('/pos/{id}/submit', [PurchaseOrderController::class, 'submit']);
        Route::put('/purchase-orders/{id}/submit', [PurchaseOrderController::class, 'submit']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/pos/{id}/approve', [PurchaseOrderController::class, 'approve']);
        Route::put('/pos/{id}/reject', [PurchaseOrderController::class, 'reject']);
        Route::put('/purchase-orders/{id}/approve', [PurchaseOrderController::class, 'approve']);
        Route::put('/purchase-orders/{id}/reject', [PurchaseOrderController::class, 'reject']);
    });
    Route::middleware('role:ADMIN,ENGINEER')->group(function () {
        Route::put('/pos/{id}/route', [PurchaseOrderController::class, 'route']);
        Route::put('/purchase-orders/{id}/route', [PurchaseOrderController::class, 'route']);
    });
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/purchase-orders/{id}/attachments', [PurchaseOrderController::class, 'getAttachments']);
        Route::post('/purchase-orders/{id}/attachments', [PurchaseOrderController::class, 'uploadAttachment']);
        Route::delete('/attachments/{attachment}', [PurchaseOrderController::class, 'deleteAttachment']);
    });

    // ─── SPK ───────────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/spks', [SpkController::class, 'index']);
        Route::get('/spks/{id}', [SpkController::class, 'show']);
    });
    Route::middleware('role:ADMIN,PURCHASING_LEGAL')->group(function () {
        Route::post('/spks', [SpkController::class, 'store']);
        Route::put('/spks/{id}/submit', [SpkController::class, 'submit']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/spks/{id}/approve', [SpkController::class, 'approve']);
        Route::put('/spks/{id}/reject', [SpkController::class, 'reject']);
    });

    // ─── Invoices ──────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::get('/invoices/{id}', [InvoiceController::class, 'show']);
    });
    Route::middleware('role:ADMIN,PURCHASING_LEGAL')->group(function () {
        Route::post('/invoices', [InvoiceController::class, 'store']);
        Route::post('/invoices/{id}/attachments', [InvoiceController::class, 'uploadAttachment']);
        Route::delete('/invoice-attachments/{attachment}', [InvoiceController::class, 'deleteAttachment']);
    });
    Route::middleware('role:ADMIN,ENGINEER')->group(function () {
        Route::put('/invoices/{id}/engineer-verify', [InvoiceController::class, 'verifyEngineer']);
    });
    Route::middleware('role:ADMIN,VERIFIKATOR_KEU')->group(function () {
        Route::put('/invoices/{id}/finance-verify', [InvoiceController::class, 'verifyFinance']);
        Route::put('/invoices/{id}/cashflow-approve', [InvoiceController::class, 'cashflowApprove']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/invoices/{id}/manager-approve', [InvoiceController::class, 'approveManager']);
    });
    Route::middleware('role:ADMIN,KEU_KANTOR')->group(function () {
        Route::post('/invoices/{id}/payments', [InvoiceController::class, 'executePayment']);
    });

    // ─── Purchase Requisitions ─────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/purchase-requisitions', [PurchaseRequisitionController::class, 'index']);
        Route::get('/purchase-requisitions/{id}', [PurchaseRequisitionController::class, 'show']);
    });
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER')->group(function () {
        Route::post('/purchase-requisitions', [PurchaseRequisitionController::class, 'store']);
        Route::put('/purchase-requisitions/{id}', [PurchaseRequisitionController::class, 'update']);
        Route::patch('/purchase-requisitions/{id}', [PurchaseRequisitionController::class, 'update']);
        Route::delete('/purchase-requisitions/{id}', [PurchaseRequisitionController::class, 'destroy']);
    });

    // ─── Fund Requests ────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/fund-requests', [FundRequestController::class, 'index']);
        Route::get('/fund-requests/{id}', [FundRequestController::class, 'show']);
    });
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER')->group(function () {
        Route::post('/fund-requests', [FundRequestController::class, 'store']);
    });
    Route::middleware('role:ADMIN,VERIFIKATOR_KEU')->group(function () {
        Route::put('/fund-requests/{id}/verify', [FundRequestController::class, 'verifyRequest']);
        Route::put('/fund-requests/{id}/reject', [FundRequestController::class, 'reject']);
        Route::put('/fund-requests/{id}/lpj-verify', [FundRequestController::class, 'verifyLpj']);
    });
    Route::middleware('role:ADMIN,MGR_KOMERSIAL')->group(function () {
        Route::put('/fund-requests/{id}/approve', [FundRequestController::class, 'approve']);
        Route::put('/fund-requests/{id}/reject-manager', [FundRequestController::class, 'reject']);
        Route::put('/fund-requests/{id}/lpj-approve', [FundRequestController::class, 'approveLpj']);
    });
    Route::middleware('role:ADMIN,KEU_KANTOR')->group(function () {
        Route::post('/fund-requests/{id}/payments', [FundRequestController::class, 'pay']);
    });
    Route::middleware('role:ADMIN,LAPANGAN')->group(function () {
        Route::put('/fund-requests/{id}/lpj', [FundRequestController::class, 'submitLpj']);
        Route::post('/fund-requests/{id}/attachments', [FundRequestController::class, 'uploadAttachment']);
        Route::delete('/fund-request-attachments/{attachment}', [FundRequestController::class, 'deleteAttachment']);
    });

    // ─── Fund Receipts ────────────────────────────────────────────────
    Route::middleware('role:ADMIN,KEU_KANTOR,VERIFIKATOR_KEU')->group(function () {
        Route::get('/fund-receipts', [FundReceiptController::class, 'index']);
        Route::post('/fund-receipts', [FundReceiptController::class, 'store']);
        Route::put('/fund-receipts/{id}/confirm', [FundReceiptController::class, 'confirm']);
        Route::put('/fund-receipts/{id}/dispute', [FundReceiptController::class, 'dispute']);
    });

    // ─── Goods Receipts ───────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/goods-receipts', [GoodsReceiptController::class, 'index']);
        Route::get('/pos/{poId}/goods-receipts', [GoodsReceiptController::class, 'getByPo']);
    });
    Route::middleware('role:ADMIN,LAPANGAN,PURCHASING_LEGAL')->group(function () {
        Route::post('/goods-receipts', [GoodsReceiptController::class, 'store']);
    });

    // ─── Opnames ──────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/opnames', [OpnameController::class, 'index']);
    });
    Route::middleware('role:ADMIN,LAPANGAN')->group(function () {
        Route::post('/opnames', [OpnameController::class, 'store']);
    });
    Route::middleware('role:ADMIN,ENGINEER')->group(function () {
        Route::put('/opnames/{id}/approve', [OpnameController::class, 'approve']);
        Route::put('/opnames/{id}/reject', [OpnameController::class, 'reject']);
    });

    // ─── BAST ───────────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/basts', [BastController::class, 'index']);
        Route::post('/basts', [BastController::class, 'store']);
        Route::put('/basts/{id}', [BastController::class, 'update']);
        Route::delete('/basts/{id}', [BastController::class, 'destroy']);
    });

    // ─── Inventory ────────────────────────────────────────────────────
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

    // ─── Audit Logs ───────────────────────────────────────────────────
    Route::middleware('role:ADMIN')->group(function () {
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });

    // ─── Suppliers ────────────────────────────────────────────────────
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

    // ─── General Ledger ───────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/general-ledger', [GeneralLedgerController::class, 'index']);
        Route::get('/general-ledger/trial-balance', [GeneralLedgerController::class, 'trialBalance']);
        Route::get('/general-ledger/export', [GeneralLedgerController::class, 'export']);
        Route::get('/general-ledger/{journal_number}', [GeneralLedgerController::class, 'show']);
    });
    Route::middleware('role:ADMIN,ACCOUNTING')->group(function () {
        Route::post('/general-ledger', [GeneralLedgerController::class, 'store']);
    });

    Route::middleware('role:ADMIN,ACCOUNTING')->group(function () {
        Route::get('/bank-statements', [BankStatementController::class, 'index']);
        Route::post('/bank-statements', [BankStatementController::class, 'store']);
        Route::post('/bank-statements/upload', [BankStatementController::class, 'uploadCsv']);
        Route::put('/bank-statements/{id}/match', [BankStatementController::class, 'match']);
    });

    // ─── Chart of Accounts ────────────────────────────────────────────
    Route::middleware('role:ADMIN,ACCOUNTING')->group(function () {
        Route::get('/chart-of-accounts', [ChartOfAccountController::class, 'index']);
        Route::post('/chart-of-accounts', [ChartOfAccountController::class, 'store']);
        Route::get('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'show']);
        Route::put('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'update']);
        Route::patch('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'update']);
        Route::delete('/chart-of-accounts/{id}', [ChartOfAccountController::class, 'destroy']);
    });

    // ─── Dashboard Reports ────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/dashboard/executive', [DashboardReportController::class, 'executive']);
        Route::get('/dashboard/financial', [DashboardReportController::class, 'financial']);
        Route::get('/dashboard/projects', [DashboardReportController::class, 'projects']);
    });

    // ─── Taxes ────────────────────────────────────────────────────────
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
        // Restitusi endpoints
        Route::post('/taxes/{id}/restitusi', [TaxController::class, 'submitRestitusi']);
        Route::put('/taxes/{id}/restitusi/approve', [TaxController::class, 'approveRestitusi']);
        Route::put('/taxes/{id}/restitusi/pay', [TaxController::class, 'payRestitusi']);
    });

    // ─── E-Faktur ─────────────────────────────────────────────────────
    Route::middleware('role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING')->group(function () {
        Route::get('/efaktur', [EfakturController::class, 'index']);
        Route::get('/efaktur/{id}', [EfakturController::class, 'show']);
    });
    Route::middleware('role:ADMIN,PAJAK')->group(function () {
        Route::post('/efaktur/upload', [EfakturController::class, 'uploadCsv']);
        Route::put('/efaktur/{id}/validate', [EfakturController::class, 'validateRecord']);
        Route::put('/efaktur/{id}/status', [EfakturController::class, 'updateStatus']);
        Route::put('/efaktur/{id}/taxable-confirmation', [EfakturController::class, 'confirmTaxable']);
        Route::put('/efaktur/{id}/kpp-status', [EfakturController::class, 'submitKpp']);
        Route::delete('/efaktur/{id}', [EfakturController::class, 'destroy']);
    });
    Route::middleware('role:ADMIN,ACCOUNTING')->group(function () {
        Route::put('/efaktur/{id}/accounting-post', [EfakturController::class, 'postToAccounting']);
    });

    // ─── Financial Reports ────────────────────────────────────────────
    Route::middleware('role:ADMIN,ACCOUNTING,PAJAK,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR')->group(function () {
        Route::get('/reports/neraca', [FinancialReportController::class, 'neraca']);
        Route::get('/reports/laba-rugi', [FinancialReportController::class, 'labaRugi']);
        Route::get('/reports/arus-kas', [FinancialReportController::class, 'arusKas']);
    });

    // ─── Users / Roles ────────────────────────────────────────────────
    Route::middleware('role:ADMIN')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::put('users/{user}/role', [UserController::class, 'assignRole']);
        Route::get('roles', [RoleController::class, 'index']);
    });
});
