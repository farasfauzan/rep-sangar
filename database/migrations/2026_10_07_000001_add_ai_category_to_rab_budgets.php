<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rab_budgets', function (Blueprint $table) {
            $table->string('ai_category')->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('rab_budgets', function (Blueprint $table) {
            $table->dropColumn('ai_category');
        });
    }
};