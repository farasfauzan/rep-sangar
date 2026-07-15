<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('efakturs', function (Blueprint $table) {
            $table->string('taxable_confirmation')->default('PENDING')->after('status');
            $table->string('kpp_document_status')->default('PENDING')->after('taxable_confirmation');
            $table->string('ppn_treatment')->default('COMPENSATE')->after('kpp_document_status');
            $table->timestamp('accounting_posted_at')->nullable()->after('ppn_treatment');
            $table->foreignId('accounting_posted_by')->nullable()->after('accounting_posted_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('efakturs', function (Blueprint $table) {
            $table->dropForeign(['accounting_posted_by']);
            $table->dropColumn(['taxable_confirmation', 'kpp_document_status', 'ppn_treatment', 'accounting_posted_at', 'accounting_posted_by']);
        });
    }
};
