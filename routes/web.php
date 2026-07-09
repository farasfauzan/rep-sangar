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

// RAB routes (web auth, not API token)
Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('/rab/preview', [\App\Http\Controllers\Api\RabBudgetController::class, 'preview']);
    Route::post('/rab/import', [\App\Http\Controllers\Api\RabBudgetController::class, 'import']);
    Route::post('/rab/auto-import', [\App\Http\Controllers\Api\RabBudgetController::class, 'autoImport']);
    Route::get('/projects/{projectId}/rab', [\App\Http\Controllers\Api\RabBudgetController::class, 'index']);
});

