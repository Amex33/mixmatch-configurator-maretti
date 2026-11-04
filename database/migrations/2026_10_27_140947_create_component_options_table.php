<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Keuzes binnen een stap. Regels (fitting, lichten, vorm, montage) staan in meta.
     */
    public function up(): void
    {
        Schema::create('component_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('configurator_component_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('name');
            $table->string('group')->nullable();
            $table->string('sku')->nullable();
            $table->json('meta')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['configurator_component_id', 'key']);
            $table->index('sku');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('component_options');
    }
};
