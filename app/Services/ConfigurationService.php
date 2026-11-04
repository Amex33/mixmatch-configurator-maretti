<?php

namespace App\Services;

use App\Models\Configuration;
use App\Models\Configurator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Maakt van de keuzes een stuklijst (glas, pendel, lamp, basis, montage) en slaat die op.
 */
class ConfigurationService
{
    public function __construct(
        private CompatibilityService $compatibility,
        private PricingService $pricing,
    ) {}

    public function build(Configurator $configurator, array $selections): array
    {
        $resolved = $this->compatibility->resolve($configurator, $selections);
        $errors = $this->compatibility->errors($configurator, $resolved);
        $priced = $this->pricing->price($this->items($resolved));

        $warnings = collect();

        if ($resolved['length'] === 'custom') {
            $warnings->push('Afwijkende snoerlengte ('.str_replace('.', ',', (string) $resolved['custom_length']).' m): de prijs volgt in de offerte.');
        }

        if ($this->customCable($resolved)) {
            $warnings->push('Ander snoer ('.$resolved['cable']->name.'): Maretti monteert het snoer op maat, de prijs wordt in de offerte bevestigd.');
        }

        $finishOnRequest = $resolved['base'] && $this->compatibility->baseSku($resolved) === null;

        if ($finishOnRequest) {
            $warnings->push("Plafondbasis in {$resolved['base_color']}: deze kleur maakt Maretti op aanvraag. We rekenen met de zwarte uitvoering, de prijs volgt in de offerte.");
        }

        if ($priced['missing_prices']->isNotEmpty()) {
            $warnings->push('Voor '.$priced['missing_prices']->implode(', ').' is geen prijs bekend: deze configuratie kan alleen via een offerte.');
        }

        $discontinued = $priced['items']->where('discontinued', true)->pluck('sku');

        if ($discontinued->isNotEmpty()) {
            $warnings->push('Uitlopend artikel: '.$discontinued->implode(', ').'.');
        }

        return [
            ...$priced,
            'lights' => $resolved['lights'],
            'requires_assembly' => $resolved['base'] ? $this->compatibility->requiresAssembly($resolved) : false,
            'quote_only' => $resolved['length'] === 'custom' || $this->customCable($resolved) || $finishOnRequest || $priced['missing_prices']->isNotEmpty(),
            'valid' => $errors->isEmpty(),
            'errors' => $errors->values(),
            'warnings' => $warnings->values(),
            'availability' => $this->compatibility->availability($configurator, $selections),
        ];
    }

    public function save(Configurator $configurator, array $selections, ?Configuration $configuration = null): Configuration
    {
        $bom = $this->build($configurator, $selections);

        return DB::transaction(function () use ($configurator, $selections, $configuration, $bom) {
            $configuration ??= new Configuration(['status' => Configuration::STATUS_DRAFT]);
            $configuration->fill([
                'configurator_id' => $configurator->id,
                'selections' => $selections,
                'total' => $bom['total'],
                'quote_only' => $bom['quote_only'],
            ])->save();

            $configuration->items()->delete();
            $configuration->items()->createMany($bom['items']->map(fn ($item) => collect($item)
                ->only(['role', 'sku', 'description', 'quantity', 'unit_price', 'line_total'])->all()));

            return $configuration->load('items', 'configurator');
        });
    }

    public function requestQuote(Configuration $configuration, array $customer): Configuration
    {
        $configuration->update([
            'customer' => $customer,
            'status' => Configuration::STATUS_QUOTE_REQUESTED,
        ]);

        return $configuration;
    }

    /**
     * Een ander snoer kan bij elke lamp, ook bij lampen met een eigen pendel (Ozone, Hortense, Soffio): Maretti vervangt het snoer.
     */
    private function customCable(array $resolved): bool
    {
        return $resolved['cable'] !== null && $resolved['glasses']->filter()->isNotEmpty();
    }

    /**
     * Telt per sku op: 15 x hetzelfde glas wordt één regel met aantal 15.
     */
    private function items(array $resolved): Collection
    {
        $items = collect();

        foreach ($resolved['glasses']->filter() as $i => $glass) {
            $items->push(['role' => 'glass', 'sku' => $glass->sku]);
            $items->push(['role' => 'pendant', 'sku' => $resolved['pendants'][$i]?->sku]);
            $items->push(['role' => 'bulb', 'sku' => $resolved['bulbs'][$i]]);

            foreach ($glass->attr('extra_skus', []) as $sku) {
                $items->push(['role' => 'accessory', 'sku' => $sku]);
            }
        }

        // Ander snoer: per meter, de gekozen lengte keer het aantal lichtpunten, afgerond op hele meters.
        if ($this->customCable($resolved)) {
            $lights = $resolved['glasses']->filter()->count();
            $items->push(['role' => 'cable', 'sku' => $resolved['cable']->sku, 'quantity' => (int) ceil($this->compatibility->cableLength($resolved) * $lights)]);
        }

        if ($driver = $this->compatibility->driverFor($resolved['configurator'], $resolved, $resolved['driver_choice'])) {
            $items->push(['role' => 'driver', 'sku' => $driver[0]->sku, 'quantity' => $driver[1]]);
        }

        if ($resolved['base']) {
            $items->push(['role' => 'base', 'sku' => $this->compatibility->baseSku($resolved) ?? $resolved['base']->sku]);

            if ($this->compatibility->requiresAssembly($resolved)) {
                $items->push(['role' => 'assembly', 'sku' => config('mixmatch.assembly_sku'), 'description' => 'Montage door Maretti Lighting']);
            }
        }

        $order = array_flip(['glass', 'accessory', 'pendant', 'cable', 'bulb', 'driver', 'base', 'assembly']);

        return $items
            ->filter(fn ($item) => filled($item['sku']))
            ->groupBy(fn ($item) => $item['role'].'|'.$item['sku'])
            ->map(fn (Collection $group) => [...$group->first(), 'quantity' => $group->sum(fn ($item) => $item['quantity'] ?? 1)])
            ->sortBy(fn ($item) => $order[$item['role']])
            ->values();
    }
}
