<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Collection;

/**
 * Prijzen komen uit de AccountView-export (tabel products), niet uit Magento:
 * niet alle onderdelen staan in de webshop.
 */
class PricingService
{
    /**
     * @param  Collection<int, array{role: string, sku: string, quantity: int, description?: string}>  $items
     */
    public function price(Collection $items): array
    {
        $products = Product::whereIn('sku', $items->pluck('sku'))->get()->keyBy('sku');

        $lines = $items->map(function (array $item) use ($products) {
            $product = $products->get($item['sku']);
            $unit = $product?->price !== null && (float) $product->price > 0 ? (float) $product->price : null;

            return [
                ...$item,
                'description' => $item['description'] ?? $product?->name ?? $item['sku'],
                'unit_price' => $unit,
                'line_total' => $unit === null ? null : round($unit * $item['quantity'], 2),
                'stock' => $product?->stock,
                'discontinued' => (bool) $product?->discontinued,
                'known' => $product !== null,
            ];
        })->values();

        return [
            'items' => $lines,
            'total' => round($lines->sum('line_total'), 2),
            'missing_prices' => $lines->whereNull('unit_price')->pluck('sku')->values(),
        ];
    }

    public function unitPrice(?string $sku): ?float
    {
        $price = $sku === null ? null : Product::where('sku', $sku)->value('price');

        return $price !== null && (float) $price > 0 ? (float) $price : null;
    }
}
