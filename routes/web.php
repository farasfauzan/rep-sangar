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
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

Route::get('/po', function () {
    return Inertia::render('PurchaseOrder');
})->middleware(['auth', 'verified'])->name('po');

Route::get('/po/create', function () {
    return Inertia::render('CreatePO');
})->middleware(['auth', 'verified'])->name('po.create');

Route::get('/goods-receipts', function () {
    return Inertia::render('GoodsReceipt');
})->middleware(['auth', 'verified'])->name('goods-receipts');

Route::get('/opname', function () {
    return Inertia::render('OpnamePage');
})->middleware(['auth', 'verified'])->name('opname');

Route::get('/invoicing', function () {
    return Inertia::render('InvoiceAdmin');
})->middleware(['auth', 'verified'])->name('invoicing');

Route::get('/approval', function () {
    return Inertia::render('ApprovalDashboard');
})->middleware(['auth', 'verified'])->name('approval');

Route::get('/payment', function () {
    return Inertia::render('PaymentExecution');
})->middleware(['auth', 'verified'])->name('payment');

Route::get('/fund-requests', function () {
    return Inertia::render('FundRequestPage');
})->middleware(['auth', 'verified'])->name('fund-requests');

Route::get('/spk', function () {
    return Inertia::render('Spk');
})->middleware(['auth', 'verified'])->name('spk');

Route::get('/rab-control', function () {
    return Inertia::render('RabControl');
})->middleware(['auth', 'verified'])->name('rab-control');

Route::get('/rab-storage', [\App\Http\Controllers\RabStorageController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('rab-storage');

Route::get('/rab-storage/{job}/download', [\App\Http\Controllers\RabStorageController::class, 'download'])
    ->middleware(['auth', 'verified'])
    ->name('rab-storage.download');

// RAB routes (web auth, not API token)
Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('/rab/preview', [\App\Http\Controllers\Api\RabBudgetController::class, 'preview']);
    Route::post('/rab/import', [\App\Http\Controllers\Api\RabBudgetController::class, 'autoImport']);
    Route::post('/rab/auto-import', [\App\Http\Controllers\Api\RabBudgetController::class, 'autoImport']);
    Route::get('/rab/import-job/{id}', [\App\Http\Controllers\Api\RabBudgetController::class, 'getImportStatus']);
    Route::post('/rab/import-job/{id}/confirm', [\App\Http\Controllers\Api\RabBudgetController::class, 'confirmImport']);
    Route::post('/rab/import-async', [\App\Http\Controllers\Api\RabBudgetController::class, 'importAsync']);
    Route::get('/projects/{projectId}/rab', [\App\Http\Controllers\Api\RabBudgetController::class, 'index']);
    Route::post('/rab/submit-for-approval', [\App\Http\Controllers\Api\RabBudgetController::class, 'submitForApproval']);
    Route::post('/rab/approve', [\App\Http\Controllers\Api\RabBudgetController::class, 'approve']);
    Route::post('/rab/reject', [\App\Http\Controllers\Api\RabBudgetController::class, 'reject']);
});

// Supplier routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/suppliers', fn () => Inertia::render('SupplierList'))->name('suppliers');
    Route::get('/suppliers/create', fn () => Inertia::render('SupplierForm'))->name('suppliers.create');
    Route::get('/suppliers/{id}/edit', fn ($id) => Inertia::render('SupplierForm', ['id' => $id]))->name('suppliers.edit');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/faktur-pajak', fn () => Inertia::render('FakturPajak'))->name('faktur-pajak');
    Route::get('/e-faktur-csv', fn () => Inertia::render('EFakturCsv'))->name('e-faktur-csv');
    Route::get('/posting-jurnal', fn () => Inertia::render('PostingJurnal'))->name('posting-jurnal');
    Route::get('/laporan-keuangan', fn () => Inertia::render('LaporanKeuangan'))->name('laporan-keuangan');
    Route::get('/audit-trail', fn () => Inertia::render('AuditTrail'))->name('audit-trail');
    Route::get('/admin/users', fn () => Inertia::render('UserManagement'))->name('admin.users');
});

// Purchase Order detail & edit routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/purchase-orders/{id}', fn ($id) => Inertia::render('PurchaseOrderDetail', ['id' => $id]))->name('purchase-orders.show');
    Route::get('/purchase-orders/{id}/edit', fn ($id) => Inertia::render('PurchaseOrderEdit', ['id' => $id]))->name('purchase-orders.edit');
});
