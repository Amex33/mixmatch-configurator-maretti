<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * De stappen van een configurator: glass, pendant, base, composition, assembly.
     */
    public function up(): void
    {
        Schema::create('configurator_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('configurator_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedTinyInteger('step');
            $table->timestamps();

            $table->unique(['configurator_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('configurator_components');
    }
};
