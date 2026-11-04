<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ComponentOption;
use App\Models\Configurator;
use App\Models\ConfiguratorComponent;
use App\Models\Product;
use Illuminate\Support\Str;

class ConfiguratorController extends Controller
{
    public function index()
    {
        return Configurator::where('active', true)->orderBy('sort')
            ->get(['slug', 'name', 'description', 'settings']);
    }

    /**
     * Alle stappen en opties van een lijn, met prijs en foto uit de AccountView-export.
     */
    public function show(Configurator $configurator)
    {
        $configurator->load('components.options');

        $skus = $configurator->components->flatMap->options
            ->flatMap(fn (ComponentOption $option) => [$option->sku, $option->attr('bulb_sku'), ...array_values($option->attr('finishes', []))])
            ->filter()->unique();
        $products = Product::whereIn('sku', $skus)->get()->keyBy('sku');

        return [
            'slug' => $configurator->slug,
            'name' => $configurator->name,
            'description' => $configurator->description,
            'settings' => $configurator->settings,
            'cable_lengths' => config('mixmatch.cable_lengths'),
            'cable_min' => config('mixmatch.cable_min'),
            'cable_max' => config('mixmatch.cable_max'),
            'lifestyle' => $this->lifestyle($configurator),
            'components' => $configurator->components->map(fn (ConfiguratorComponent $component) => [
                'key' => $component->key,
                'name' => $component->name,
                'description' => $component->description,
                'step' => $component->step,
                'options' => $component->options->map(fn (ComponentOption $option) => [
                    'key' => $option->key,
                    'name' => $option->name,
                    'group' => $option->group,
                    'sku' => $option->sku,
                    'meta' => $option->meta ?? [],
                    'price' => ($price = $products->get($option->sku)?->price) !== null && (float) $price > 0 ? (float) $price : null,
                    'image' => $this->image($option) ?? $products->get($option->sku)?->image_url,
                    // Plafondbasis: prijs per kleur (null = op aanvraag).
                    'finish_prices' => collect($option->attr('finishes', []))
                        ->map(fn (?string $sku) => $sku && ($price = $products->get($sku)?->price) !== null && (float) $price > 0 ? (float) $price : null),
                ])->values(),
            ])->values(),
        ];
    }

       /**
     * Eigen foto in public/images/configurator/<map>, op optiesleutel (tulip-s-koper.jpg) of op sku (80.1200.20.jpg).
     * Gaat voor op de webshopfoto, zodat ook opties zonder webshopfoto een afbeelding kunnen krijgen.
     */
    private function image(ComponentOption $option): ?string
    {
        foreach (['lampen', 'fittings', 'kabel', 'ceiling-base'] as $folder) {
            foreach (array_filter([$option->attr('image'), $option->key, $option->sku]) as $name) {
                foreach (['jpg', 'png', 'webp'] as $extension) {
                    $path = "images/configurator/{$folder}/{$name}.{$extension}";

                    if (is_file(public_path($path))) {
                        return asset($path);
                    }
                }
            }
        }

        return null;
    }

    /**
     * Sfeerfoto's per lamp uit public/images/configurator/lifestyle: een foto hoort bij een lamp als de bestandsnaam
     * met de naam van de lamp begint (tulip1.jpg, tulip-iosa.jpg bij Tulip; glass-jewel-hal.jpg bij Glass Jewel),
     * of als hij in de map van de lamp staat (lifestyle/icosa/*, lifestyle/glass-jewel/*).
     */
    private function lifestyle(Configurator $configurator): array
    {
        $images = fn (string $pattern) => collect(glob(public_path("images/configurator/lifestyle/{$pattern}")))
            ->filter(fn (string $file) => in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png', 'webp'], true))
            ->map(fn (string $file) => basename($file));
        $files = $images('*.*');

        return $configurator->component('glass')->options->pluck('group')->unique()
            ->mapWithKeys(fn (string $family) => [$family => $files
                ->filter(fn (string $file) => Str::startsWith(Str::lower($file), Str::slug($family)))
                ->map(fn (string $file) => asset('images/configurator/lifestyle/'.rawurlencode($file)))
                ->merge($images(Str::slug($family).'/*.*')
                    ->map(fn (string $file) => asset('images/configurator/lifestyle/'.Str::slug($family).'/'.rawurlencode($file))))
                ->values()->all()])
            ->filter()
            ->all();
    }
}
