<?php

namespace App\Services;

use App\Models\ComponentOption;
use App\Models\Configurator;
use Illuminate\Support\Collection;

/**
 * Bepaalt welke keuzes bij elkaar passen, volgens de regels uit de Mix & Match-catalogus.
 *
 * Selecties komen als:
 *   glass        string|string[]  glas per positie (één string = overal hetzelfde glas)
 *   bulb         string|null      lichtbron (sku), 'none' = zonder, null = het advies bij het glas
 *   cable        string|null      ander snoer per meter (sku), null = het standaardsnoer van de pendel
 *   base_color   string|null      zwart (standaard), wit, brons of rvs
 *   driver       string|null      driver (sku) bij Milliamps, null = de eerste die past
 *   length       1.5|3|'custom'   snoerlengte in meters
 *   custom_length float|null      gewenste lengte als length = 'custom'
 *   base         string           plafondbasis
 *   composition  string           compositie
 *   assembly     'self'|'maretti'
 */
class CompatibilityService
{
    /**
     * Zet de ruwe selecties om naar de gekozen opties, met precies één glas per lichtpunt.
     */
    public function resolve(Configurator $configurator, array $selections): array
    {
        $configurator->loadMissing('components.options');

        $glassComponent = $configurator->component('glass');
        $glassKeys = $selections['glass'] ?? [];

        // Een complete hanglamp (Hortense) hangt aan zijn eigen plafondkap: geen basis, één lamp.
        $standalone = (bool) $glassComponent->option(is_array($glassKeys) ? ($glassKeys[0] ?? null) : $glassKeys)?->attr('standalone');

        $base = $standalone ? null : $configurator->component('base')->option($selections['base'] ?? null);
        $lights = (int) ($base?->attr('lights') ?? 1);

        $glassKeys = is_array($glassKeys) ? array_values($glassKeys) : array_fill(0, $lights, $glassKeys);
        $glassKeys = array_slice(array_pad($glassKeys, $lights, $glassKeys[0] ?? null), 0, $lights);

        $glasses = collect($glassKeys)->map(fn ($key) => $glassComponent->option($key));

        $length = $selections['length'] ?? null;
        $bulb = $selections['bulb'] ?? null;

        return [
            'configurator' => $configurator,
            'standalone' => $standalone,
            'base' => $base,
            'base_color' => $selections['base_color'] ?? 'zwart',
            'lights' => $lights,
            'glasses' => $glasses,
            'bulbs' => $glasses->map(fn (?ComponentOption $glass) => $this->bulbFor($configurator, $glass, $bulb)),
            'length' => $length,
            'custom_length' => $length === 'custom' ? (float) ($selections['custom_length'] ?? 0) : null,
            'cable' => $configurator->component('cable')?->option($selections['cable'] ?? null),
            'driver_choice' => $selections['driver'] ?? null,
            'pendants' => $glasses->map(fn (?ComponentOption $glass) => $this->pendantFor($configurator, $glass, $length)),
            'composition' => $configurator->component('composition')->option($selections['composition'] ?? null),
            'assembly' => $selections['assembly'] ?? null,
        ];
    }

    /**
     * De pendel hangt af van het glas (fitting en familie) en de gekozen lengte.
     * Bij een afwijkende lengte rekenen we met de 3 meter-pendel; de prijs volgt in de offerte.
     */
    public function pendantFor(Configurator $configurator, ?ComponentOption $glass, mixed $length): ?ComponentOption
    {
        $group = $glass?->attr('pendant_group');

        if ($group === null || $glass->attr('pendant_included')) {
            return null;
        }

        $length = $length === 'custom' ? 3.0 : (float) $length;

        return $configurator->component('pendant')->options
            ->first(fn (ComponentOption $pendant) => $pendant->attr('pendant_group') === $group && (float) $pendant->attr('length') === $length);
    }

    /**
     * Sku van de lichtbron voor dit glas: de gekozen lamp als die in de fitting past, anders het advies bij het glas.
     * Glazen zonder advies (lichtbron inbegrepen of ingebouwde LED) krijgen nooit een losse lamp.
     */
    public function bulbFor(Configurator $configurator, ?ComponentOption $glass, ?string $choice): ?string
    {
        $advised = $glass?->attr('bulb_sku');

        if ($advised === null || $choice === 'none') {
            return $choice === 'none' ? null : $advised;
        }

        $bulb = $configurator->component('bulb')?->option($choice);

        return $bulb && $bulb->attr('fitting') === $glass->attr('fitting') ? $bulb->sku : $advised;
    }

    /**
     * Geeft per stap aan welke opties nu kiesbaar zijn, met de reden als dat niet zo is.
     */
    public function availability(Configurator $configurator, array $selections): array
    {
        $resolved = $this->resolve($configurator, $selections);
        $groups = $resolved['glasses']->filter()->map->attr('pendant_group')->filter()->unique();
        $base = $resolved['base'];
        $result = [];

        foreach ($configurator->component('pendant')->options as $pendant) {
            $result['pendant'][$pendant->key] = $groups->contains($pendant->attr('pendant_group'))
                ? null : 'Past niet bij het gekozen glas.';
        }

        $fittings = $resolved['glasses']->filter(fn (?ComponentOption $glass) => $glass?->attr('bulb_sku'))->map->attr('fitting')->unique();

        foreach ($configurator->component('bulb')?->options ?? [] as $bulb) {
            $result['bulb'][$bulb->key] = $bulb->key === 'none' || $fittings->contains($bulb->attr('fitting'))
                ? null : 'Past niet in de fitting van het gekozen glas.';
        }

        foreach ($configurator->component('cable')?->options ?? [] as $cable) {
            $result['cable'][$cable->key] = $this->cableReason($configurator, $cable);
        }

        foreach ($configurator->component('driver')?->options ?? [] as $driver) {
            $result['driver'][$driver->key] = $this->driverReason($driver, $resolved);
        }

        foreach ($configurator->component('composition')->options as $composition) {
            $result['composition'][$composition->key] = $base === null ? null : $this->compositionReason($base, $composition);
        }

        foreach ($configurator->component('assembly')->options as $assembly) {
            $result['assembly'][$assembly->key] = $assembly->key === 'self' && $base?->attr('requires_assembly')
                ? 'Deze plafondbasis wordt altijd door Maretti gemonteerd.' : null;
        }

        return $result;
    }

    /**
     * Controleert of de configuratie compleet en geldig is.
     *
     * @return Collection<int, string>
     */
    public function errors(Configurator $configurator, array $resolved): Collection
    {
        $errors = collect();

        if ($resolved['standalone']) {
            if ($resolved['length'] === 'custom' && $resolved['custom_length'] <= 0) {
                $errors->push('Vul de gewenste snoerlengte in.');
            }

            return $errors;
        }

        if ($resolved['base'] === null) {
            $errors->push('Kies een plafondbasis.');
        }

        if ($resolved['glasses']->isEmpty() || $resolved['glasses']->contains(null)) {
            $errors->push('Kies een glas of kap voor elk lichtpunt.');
        }

        if ($configurator->component('driver') && $resolved['base'] && ! $resolved['base']->attr('includes_driver')
            && $resolved['glasses']->filter()->isNotEmpty() && $this->driverFor($configurator, $resolved, $resolved['driver_choice']) === null) {
            $errors->push('Er is geen driver die bij dit aantal lampen past. Neem contact op met Maretti.');
        }

        // LED-lampen (eigen driver) en lampen met een fitting (230V-lichtbron) passen niet samen in één armatuur.
        if ($resolved['glasses']->filter()->map(fn (ComponentOption $glass) => $this->lightType($glass))->unique()->count() > 1) {
            $errors->push('LED-lampen en lampen met een fitting kun je niet in één armatuur combineren.');
        }

        $needsPendant = $resolved['glasses']->filter()->contains(fn (ComponentOption $glass) => ! $glass->attr('pendant_included'));

        if ($needsPendant && ! in_array($resolved['length'], [...config('mixmatch.cable_lengths'), 'custom'], false)) {
            $errors->push('Kies een snoerlengte.');
        } elseif ($resolved['length'] === 'custom' && $resolved['custom_length'] <= 0) {
            $errors->push('Vul de gewenste snoerlengte in.');
        } elseif ($resolved['length'] === 'custom' && ($range = $this->cableRange($resolved)) && ($resolved['custom_length'] < $range[0] || $resolved['custom_length'] > $range[1])) {
            $errors->push('De snoerlengte moet tussen '.str_replace('.', ',', (string) $range[0]).' en '.str_replace('.', ',', (string) $range[1]).' meter liggen.');
        } elseif ($needsPendant && $resolved['pendants']->contains(null)) {
            $errors->push('Voor dit glas is geen pendel in deze lengte beschikbaar.');
        }

        if ($resolved['cable'] && ($reason = $this->cableReason($configurator, $resolved['cable']))) {
            $errors->push($reason);
        }

        // Eén lamp aan een canopy heeft geen compositie.
        if ($resolved['lights'] <= 1) {
            // niets te controleren
        } elseif ($resolved['composition'] === null) {
            $errors->push('Kies een compositie.');
        } elseif ($resolved['base'] && ($reason = $this->compositionReason($resolved['base'], $resolved['composition']))) {
            $errors->push($reason);
        }

        if (! in_array($resolved['assembly'], ['self', 'maretti'], true)) {
            $errors->push('Kies of je de armatuur zelf samenstelt of laat monteren.');
        }

        return $errors;
    }

    /**
     * 'led' voor lampen met ingebouwde LED, 'bulb' voor lampen met een fitting (E27, E14, G9, G4).
     */
    public function lightType(ComponentOption $glass): string
    {
        return $glass->attr('fitting') === 'LED' ? 'led' : 'bulb';
    }

    /**
     * Driver voor Milliamps-lampen: de gekozen driver (of het advies) en hoeveel stuks er nodig zijn.
     * Een driver levert een vaste stroom (350 mA) voor een wattbereik; te veel lampen = meer drivers, te weinig = past niet.
     * Advies: zo min mogelijk drivers, bij gelijk aantal de volgorde uit config('mixmatch.drivers').
     *
     * @return array{0: ComponentOption, 1: int}|null
     */
    public function driverFor(Configurator $configurator, array $resolved, ?string $choice): ?array
    {
        $component = $configurator->component('driver');
        if (! $component || $resolved['base']?->attr('includes_driver') || $resolved['glasses']->filter()->isEmpty()) {
            return null;
        }

        $fits = fn (ComponentOption $driver) => ($n = $this->driverCount($driver, $resolved)) ? [$driver, $n] : null;
        $chosen = $component->option($choice);

        return ($chosen ? $fits($chosen) : null)
            ?? $component->options->map($fits)->filter()->sortBy(fn (array $fit, int $i) => $fit[1] * 1000 + $i)->first();
    }

    /**
     * Aantal drivers voor alle lampen samen, of null als de lampen per driver onder het minimum vermogen blijven.
     * Een driver "per armatuur" (fase-dimbaar 16.8408) komt één keer per lamp.
     */
    public function driverCount(ComponentOption $driver, array $resolved): ?int
    {
        if ($driver->attr('per_lamp')) {
            return $resolved['glasses']->filter()->count();
        }

        $watts = $resolved['glasses']->filter()->sum(fn (ComponentOption $glass) => (float) ($glass->attr('max_watt') ?: 1));
        $count = (int) max(1, ceil($watts / (float) $driver->attr('max_w')));

        return $watts / $count >= (float) $driver->attr('min_w') ? $count : null;
    }

    public function driverReason(ComponentOption $driver, array $resolved): ?string
    {
        if ($this->driverCount($driver, $resolved) !== null) {
            return null;
        }

        return 'Te weinig lampen voor deze driver (minimaal '.str_replace('.', ',', (string) $driver->attr('min_w')).' W).';
    }

    /**
     * 230V-pendels hebben een geaard snoer (3 aders) nodig, Milliamps werkt met 2 aders.
     */
    private function cableReason(Configurator $configurator, ComponentOption $cable): ?string
    {
        $cores = $configurator->setting('voltage') === 'mA' ? 2 : 3;

        return (int) $cable->attr('cores') === $cores ? null : "Past niet bij {$configurator->name} ({$cores}-aderig snoer nodig).";
    }

    /**
     * Kortste en langste snoer dat kan: de strengste grens van de gekozen glazen, anders config/mixmatch.php.
     *
     * @return array{0: float, 1: float}
     */
    public function cableRange(array $resolved): array
    {
        $glasses = $resolved['glasses']->filter();

        return [
            (float) $glasses->map->attr('cable_min')->filter()->push(config('mixmatch.cable_min'))->max(),
            (float) $glasses->map->attr('cable_max')->filter()->push(config('mixmatch.cable_max'))->min(),
        ];
    }

    /**
     * Sku van de plafondbasis in de gekozen kleur; null als die kleur alleen op aanvraag kan (dan rekenen we met zwart).
     */
    public function baseSku(array $resolved): ?string
    {
        $finishes = $resolved['base']?->attr('finishes') ?? [];

        return $finishes[$resolved['base_color']] ?? ($resolved['base_color'] === 'zwart' ? $resolved['base']?->sku : null);
    }

    /**
     * Snoerlengte in meters per lichtpunt.
     */
    public function cableLength(array $resolved): float
    {
        return $resolved['length'] === 'custom' ? (float) $resolved['custom_length'] : (float) $resolved['length'];
    }

    public function requiresAssembly(array $resolved): bool
    {
        return $resolved['assembly'] === 'maretti' || (bool) $resolved['base']?->attr('requires_assembly');
    }

    private function compositionReason(ComponentOption $base, ComponentOption $composition): ?string
    {
        $allowedByBase = $base->attr('compositions');

        if ($allowedByBase !== null && ! in_array($composition->key, $allowedByBase, true)) {
            return "{$composition->name} kan niet met deze plafondbasis.";
        }

        return in_array($base->attr('shape'), $composition->attr('shapes', []), true)
            ? null : "{$composition->name} past niet bij een ".$this->shapeName($base->attr('shape')).' plafondbasis.';
    }

    private function shapeName(string $shape): string
    {
        return ['rect' => 'rechthoekige', 'square' => 'vierkante', 'round' => 'ronde'][$shape] ?? $shape;
    }
}
