<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified', 'role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR,PAJAK,ACCOUNTING'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

Route::get('/po', function () {
    return Inertia::render('PurchaseOrder');
})->middleware(['auth', 'verified', 'role:ADMIN,LAPANGAN,ENGINEER,PURCHASING_LEGAL,VERIFIKATOR_KEU,MGR_KOMERSIAL'])->name('po');

Route::get('/po/create', function () {
    return Inertia::render('CreatePO');
})->middleware(['auth', 'verified', 'role:ADMIN,LAPANGAN,PURCHASING_LEGAL'])->name('po.create');

Route::get('/goods-receipts', function () {
    return Inertia::render('GoodsReceipt');
})->middleware(['auth', 'verified', 'role:ADMIN,LAPANGAN,PURCHASING_LEGAL'])->name('goods-receipts');

Route::get('/opname', function () {
    return Inertia::render('OpnamePage');
})->middleware(['auth', 'verified', 'role:ADMIN,LAPANGAN,ENGINEER'])->name('opname');

Route::get('/invoicing', function () {
    return Inertia::render('InvoiceAdmin');
})->middleware(['auth', 'verified', 'role:ADMIN,PURCHASING_LEGAL'])->name('invoicing');

Route::get('/approval', function () {
    return Inertia::render('ApprovalDashboard');
})->middleware(['auth', 'verified', 'role:ADMIN,ENGINEER,VERIFIKATOR_KEU,MGR_KOMERSIAL'])->name('approval');

Route::get('/payment', function () {
    return Inertia::render('PaymentExecution');
})->middleware(['auth', 'verified', 'role:ADMIN,KEU_KANTOR'])->name('payment');

Route::get('/fund-requests', function () {
    return Inertia::render('FundRequestPage');
})->middleware(['auth', 'verified', 'role:ADMIN,LAPANGAN,VERIFIKATOR_KEU,MGR_KOMERSIAL,KEU_KANTOR'])->name('fund-requests');

Route::get('/spk', function () {
    return Inertia::render('Spk');
})->middleware(['auth', 'verified', 'role:ADMIN,PURCHASING_LEGAL,MGR_KOMERSIAL,ENGINEER'])->name('spk');

Route::get('/rab-control', function () {
    return Inertia::render('RabControl');
})->middleware(['auth', 'verified'])->name('rab-control');

Route::get('/rab-import', function () {
    return Inertia::render('RabImport');
})->middleware(['auth', 'verified'])->name('rab-import');

Route::get('/rab-storage', [\App\Http\Controllers\RabStorageController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('rab-storage');

Route::get('/rab-storage/{job}/download', [\App\Http\Controllers\RabStorageController::class, 'download'])
    ->middleware(['auth', 'verified'])
    ->name('rab-storage.download');

// RAB routes (web auth, not API token)
Route::middleware(['auth', 'verified', 'role:ADMIN,PURCHASING_LEGAL'])->group(function () {
    Route::post('/rab/preview', [\App\Http\Controllers\Api\RabBudgetController::class, 'preview']);
    Route::post('/rab/import', [\App\Http\Controllers\Api\RabBudgetController::class, 'autoImport']);
    Route::post('/rab/auto-import', [\App\Http\Controllers\Api\RabBudgetController::class, 'autoImport']);
    Route::get('/rab/import-job/{id}', [\App\Http\Controllers\Api\RabBudgetController::class, 'getImportStatus']);
    Route::post('/rab/import-job/{id}/confirm', [\App\Http\Controllers\Api\RabBudgetController::class, 'confirmImport']);
    Route::post('/rab/import-job/{id}/revalidate', [\App\Http\Controllers\Api\RabBudgetController::class, 'revalidateImport']);
    Route::post('/rab/import-async', [\App\Http\Controllers\Api\RabBudgetController::class, 'importAsync']);
    Route::get('/projects/{projectId}/rab', [\App\Http\Controllers\Api\RabBudgetController::class, 'index']);
    Route::post('/rab/submit-for-approval', [\App\Http\Controllers\Api\RabBudgetController::class, 'submitForApproval']);
    Route::post('/rab/approve', [\App\Http\Controllers\Api\RabBudgetController::class, 'approve']);
    Route::post('/rab/reject', [\App\Http\Controllers\Api\RabBudgetController::class, 'reject']);
});

// Supplier routes
Route::middleware(['auth', 'verified', 'role:ADMIN,PURCHASING_LEGAL'])->group(function () {
    Route::get('/suppliers', fn () => Inertia::render('SupplierList'))->name('suppliers');
    Route::get('/suppliers/create', fn () => Inertia::render('SupplierForm'))->name('suppliers.create');
    Route::get('/suppliers/{id}/edit', fn ($id) => Inertia::render('SupplierForm', ['id' => $id]))->name('suppliers.edit');
});

Route::middleware(['auth', 'verified', 'role:ADMIN,PAJAK'])->group(function () {
    Route::get('/faktur-pajak', fn () => Inertia::render('FakturPajak'))->name('faktur-pajak');
    Route::get('/e-faktur-csv', fn () => Inertia::render('EFakturCsv'))->name('e-faktur-csv');
});

Route::middleware(['auth', 'verified', 'role:ADMIN,ACCOUNTING'])->group(function () {
    Route::get('/posting-jurnal', fn () => Inertia::render('PostingJurnal'))->name('posting-jurnal');
    Route::get('/laporan-keuangan', fn () => Inertia::render('LaporanKeuangan'))->name('laporan-keuangan');
    Route::get('/audit-trail', fn () => Inertia::render('AuditTrail'))->name('audit-trail');
    Route::get('/bank-statements', fn () => Inertia::render('BankStatements'))->name('bank-statements');
    Route::get('/admin/users', fn () => Inertia::render('UserManagement'))->name('admin.users');
});

// Inventory routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/inventory', fn () => Inertia::render('InventoryDashboard'))->name('inventory');
    Route::get('/inventory/{id}/movements', fn ($id) => Inertia::render('StockMovements', ['id' => (int) $id]))->name('inventory.movements');
});

// Purchase Order detail & edit routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/purchase-orders/{id}', fn ($id) => Inertia::render('PurchaseOrderDetail', ['id' => $id]))->name('purchase-orders.show');
    Route::get('/purchase-orders/{id}/edit', fn ($id) => Inertia::render('PurchaseOrderEdit', ['id' => $id]))->name('purchase-orders.edit');
});

// Print routes — blade templates for PDF / browser print
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/purchase-orders/{id}/print', [\App\Http\Controllers\PrintController::class, 'purchaseOrder'])->name('purchase-orders.print');
    Route::get('/purchase-orders/{id}/pdf', [\App\Http\Controllers\PrintController::class, 'purchaseOrderPdf'])->name('purchase-orders.pdf');
    Route::get('/spks/{id}/print', [\App\Http\Controllers\PrintController::class, 'spk'])->name('spks.print');
    Route::get('/spks/{id}/pdf', [\App\Http\Controllers\PrintController::class, 'spkPdf'])->name('spks.pdf');
    Route::get('/invoices/{id}/print', function ($id) {
        $invoice = \App\Models\Invoice::with(['invoiceable', 'transactions'])->findOrFail($id);
        return Inertia::render('Print/InvoicePrint', ['invoice' => $invoice]);
    })->name('invoices.print');
    Route::get('/basts/{id}/print', [\App\Http\Controllers\PrintController::class, 'bast'])->name('basts.print');
    Route::get('/basts/{id}/pdf', [\App\Http\Controllers\PrintController::class, 'bastPdf'])->name('basts.pdf');
});
