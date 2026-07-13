<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('spk_progress', function (Blueprint $table) {
            $table->foreignId('spk_id')->constrained('spks')->cascadeOnDelete();
            $table->foreignId('rab_budget_id')->nullable()->constrained('rab_budgets')->nullOnDelete();
            $table->text('work_description')->nullable();
            $table->decimal('progress_percentage', 5, 2)->default(0);
            $table->decimal('amount', 15, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->index('spk_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('spk_progress', function (Blueprint $table) {
            $table->dropForeign(['spk_id']);
            $table->dropForeign(['rab_budget_id']);
            $table->dropForeign(['created_by']);
            $table->dropIndex(['spk_id']);
            $table->dropColumn([
                'spk_id',
                'rab_budget_id',
                'work_description',
                'progress_percentage',
                'amount',
                'created_by',
            ]);
        });
    }
};
