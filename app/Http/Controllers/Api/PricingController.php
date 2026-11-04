<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Configurator;
use App\Services\ConfigurationService;
use Illuminate\Http\Request;

class PricingController extends Controller
{
    /**
     * Stuklijst en prijs voor de huidige keuzes, zonder iets op te slaan.
     */
    public function __invoke(Request $request, Configurator $configurator, ConfigurationService $configurations)
    {
        $selections = $request->validate(ConfigurationController::SELECTION_RULES);

        return $configurations->build($configurator, $selections);
    }
}
