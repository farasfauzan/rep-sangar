<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->string('journal_number')->nullable()->after('id');
            $table->string('reference_type')->nullable()->after('description');
            $table->unsignedBigInteger('reference_id')->nullable()->after('reference_type');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete()->after('project_id');
        });
    }

    public function down(): void
    {
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn(['journal_number', 'reference_type', 'reference_id', 'created_by']);
        });
    }
};
