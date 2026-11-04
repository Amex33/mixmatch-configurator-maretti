<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Configuration;
use App\Models\Configurator;
use App\Services\ConfigurationService;
use Illuminate\Http\Request;

class ConfigurationController extends Controller
{
    public const SELECTION_RULES = [
        'glass' => ['nullable'],
        'glass.*' => ['nullable', 'string'],
        'bulb' => ['nullable', 'string'],
        'cable' => ['nullable', 'string'],
        'driver' => ['nullable', 'string'],
        'length' => ['nullable'],
        'custom_length' => ['nullable', 'numeric', 'min:0.3', 'max:15'],
        'base' => ['nullable', 'string'],
        'base_color' => ['nullable', 'in:zwart,wit,brons,rvs'],
        'composition' => ['nullable', 'string'],
        'assembly' => ['nullable', 'in:self,maretti'],
    ];

    public function store(Request $request, ConfigurationService $configurations)
    {
        $data = $request->validate([
            'configurator' => ['required', 'exists:configurators,slug'],
            'selections' => ['required', 'array'],
            ...collect(self::SELECTION_RULES)->mapWithKeys(fn ($rule, $key) => ["selections.{$key}" => $rule])->all(),
        ]);

        $configurator = Configurator::where('slug', $data['configurator'])->firstOrFail();
        $bom = $configurations->build($configurator, $data['selections']);

        if (! $bom['valid']) {
            return response()->json(['message' => 'De configuratie is nog niet compleet.', 'errors' => $bom['errors']], 422);
        }

        return response()->json($this->present($configurations->save($configurator, $data['selections'])), 201);
    }

    public function show(Configuration $configuration)
    {
        return $this->present($configuration->load('items', 'configurator'));
    }

    public function quote(Request $request, Configuration $configuration, ConfigurationService $configurations)
    {
        $customer = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'company' => ['nullable', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->present($configurations->requestQuote($configuration, $customer)->load('items', 'configurator'));
    }

    private function present(Configuration $configuration): array
    {
        return [
            'uuid' => $configuration->uuid,
            'configurator' => $configuration->configurator->slug,
            'status' => $configuration->status,
            'selections' => $configuration->selections,
            'total' => (float) $configuration->total,
            'quote_only' => $configuration->quote_only,
            'items' => $configuration->items->map->only(['role', 'sku', 'description', 'quantity', 'unit_price', 'line_total']),
        ];
    }
}
