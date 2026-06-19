<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->json('closure_proof_files')->nullable()->after('proof_files');
            $table->text('closure_proof_notes')->nullable()->after('closure_proof_files');
        });
    }

    public function down(): void
    {
        Schema::table('complaints', function (Blueprint $table) {
            $table->dropColumn(['closure_proof_files', 'closure_proof_notes']);
        });
    }
};
