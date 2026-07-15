<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('parent_po_id')->nullable()->after('project_id')
                ->constrained('purchase_orders')->nullOnDelete();
            $table->date('jadwal_kirim')->nullable()->after('payment_terms');
        });

        Schema::table('spks', function (Blueprint $table) {
            $table->foreignId('source_po_id')->nullable()->after('project_id')
                ->constrained('purchase_orders')->nullOnDelete();
        });

        Schema::table('fund_requests', function (Blueprint $table) {
            $table->foreignId('verified_by')->nullable()->after('requested_by')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable()->after('verified_by');
            $table->foreignId('lpj_verified_by')->nullable()->after('lpj_submitted_at')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('lpj_verified_at')->nullable()->after('lpj_verified_by');
            $table->foreignId('lpj_approved_by')->nullable()->after('lpj_verified_at')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('lpj_approved_at')->nullable()->after('lpj_approved_by');
            $table->text('rejection_notes')->nullable()->after('lpj_notes');
        });

        Schema::table('invoice_attachments', function (Blueprint $table) {
            $table->foreignId('invoice_id')->nullable()->after('id')
                ->constrained('invoices')->cascadeOnDelete();
            $table->string('doc_type')->default('SUPPORTING')->after('invoice_id');
            $table->string('file_path')->nullable()->after('doc_type');
            $table->string('file_name')->nullable()->after('file_path');
            $table->foreignId('uploaded_by')->nullable()->after('file_name')
                ->constrained('users')->nullOnDelete();
        });

        Schema::create('fund_request_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fund_request_id')->constrained('fund_requests')->cascadeOnDelete();
            $table->string('doc_type')->default('LPJ');
            $table->string('file_path');
            $table->string('file_name');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('bank_statements', function (Blueprint $table) {
            $table->id();
            $table->date('transaction_date');
            $table->string('bank_name');
            $table->string('account_number')->nullable();
            $table->string('reference_number')->nullable()->unique();
            $table->text('description')->nullable();
            $table->decimal('debit', 20, 2)->default(0);
            $table->decimal('credit', 20, 2)->default(0);
            $table->string('status')->default('UNMATCHED');
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_statements');
        Schema::dropIfExists('fund_request_attachments');

        Schema::table('invoice_attachments', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
            $table->dropForeign(['uploaded_by']);
            $table->dropColumn(['invoice_id', 'doc_type', 'file_path', 'file_name', 'uploaded_by']);
        });

        Schema::table('fund_requests', function (Blueprint $table) {
            $table->dropForeign(['verified_by']);
            $table->dropForeign(['lpj_verified_by']);
            $table->dropForeign(['lpj_approved_by']);
            $table->dropColumn([
                'verified_by', 'verified_at', 'lpj_verified_by', 'lpj_verified_at',
                'lpj_approved_by', 'lpj_approved_at', 'rejection_notes',
            ]);
        });

        Schema::table('spks', function (Blueprint $table) {
            $table->dropForeign(['source_po_id']);
            $table->dropColumn('source_po_id');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropForeign(['parent_po_id']);
            $table->dropColumn(['parent_po_id', 'jadwal_kirim']);
        });
    }
};
