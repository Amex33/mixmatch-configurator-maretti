<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Configuration;
use App\Services\ExportService;
use App\Services\MagentoService;
use Illuminate\Http\Request;

class CartController extends Controller
{
    /**
     * Geeft de link waarmee de Magento-module de configuratie in de winkelmand zet.
     */
    public function store(Configuration $configuration, MagentoService $magento)
    {
        if ($configuration->quote_only) {
            return response()->json(['message' => 'Deze configuratie kan alleen via een offerte worden aangevraagd.'], 422);
        }

        $configuration->update(['status' => Configuration::STATUS_IN_CART]);

        return ['redirect_url' => $magento->cartUrl($configuration)];
    }

    /**
     * Melding van de Magento-module dat de bestelling is geplaatst; daarna gaat de order naar AccountView.
     */
    public function orderPlaced(Request $request, MagentoService $magento, ExportService $export)
    {
        $data = $request->validate([
            'configuration' => ['required', 'exists:configurations,uuid'],
            'order_id' => ['required', 'string', 'max:50'],
            'customer' => ['nullable', 'array'],
        ]);

        abort_unless($magento->verify($data['configuration'].'|'.$data['order_id'], $request->header('X-Mixmatch-Signature')), 403);

        $configuration = Configuration::where('uuid', $data['configuration'])->firstOrFail();
        $configuration->update([
            'status' => Configuration::STATUS_ORDERED,
            'magento_order_id' => $data['order_id'],
            'customer' => $data['customer'] ?? $configuration->customer,
        ]);

        return ['exported_to' => basename($export->toAccountView($configuration))];
    }
}
