<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Een opgeslagen ontwerp van een klant, met status van concept tot export naar AccountView.
     */
    public function up(): void
    {
        Schema::create('configurations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('configurator_id')->constrained();
            $table->string('status')->default('draft');
            $table->json('selections');
            $table->json('customer')->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->boolean('quote_only')->default(false);
            $table->string('magento_order_id')->nullable();
            $table->timestamp('exported_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('configurations');
    }
};
