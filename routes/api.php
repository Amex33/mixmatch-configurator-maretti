<?php

use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\ConfigurationController;
use App\Http\Controllers\Api\ConfiguratorController;
use App\Http\Controllers\Api\PricingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/configurators', [ConfiguratorController::class, 'index']);
Route::get('/configurators/{configurator}', [ConfiguratorController::class, 'show']);
Route::post('/configurators/{configurator}/pricing', PricingController::class);

Route::post('/configurations', [ConfigurationController::class, 'store'])->middleware('throttle:30,1');
Route::get('/configurations/{configuration}', [ConfigurationController::class, 'show']);
Route::post('/configurations/{configuration}/quote', [ConfigurationController::class, 'quote'])->middleware('throttle:5,1');
Route::post('/configurations/{configuration}/cart', [CartController::class, 'store'])->middleware('throttle:30,1');

// Aangeroepen door de Magento-module na een geplaatste bestelling.
Route::post('/magento/order-placed', [CartController::class, 'orderPlaced']);
