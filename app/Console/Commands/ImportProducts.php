<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use XMLReader;

#[Signature('mixmatch:import-products {path? : Pad naar products.xml}')]
#[Description('Importeer artikelen en verkoopprijzen uit de AccountView-export')]
class ImportProducts extends Command
{
    // Extra velden die we bewaren voor de configurator en de 3D-weergave.
    private const DATA_FIELDS = [
        'Artikelnaam', 'Serie', 'Designer', 'Fitting', 'Lichtbron_type', 'Kleur_Code',
        'Product_diameter', 'Product_lengte', 'Product_breedte', 'Product_hoogte', 'Extra_omschrijving',
    ];

    public function handle(): int
    {
        $path = $this->argument('path') ?? config('mixmatch.products_xml');

        if (! is_file($path)) {
            $this->error("Bestand niet gevonden: {$path}");

            return self::FAILURE;
        }

        $reader = new XMLReader;
        $reader->open($path);
        $batch = [];
        $count = 0;

        while ($reader->read()) {
            if ($reader->nodeType !== XMLReader::ELEMENT || $reader->name !== 'product') {
                continue;
            }

            $node = simplexml_load_string($reader->readOuterXml());
            $sku = trim((string) $node->Artikelnummer);

            if ($sku === '') {
                continue;
            }

            $price = trim((string) $node->Verkoopprijs_excl_btw);

            $batch[] = [
                'sku' => $sku,
                'name' => trim((string) $node->Artikelomschrijving) ?: $sku,
                'price' => $price === '' ? null : (float) $price,
                'stock' => (int) $node->Aantal_vrij_niet_geblokkeerd,
                'discontinued' => (string) $node->Uitlopend === 'true',
                'blocked' => (string) $node->Geblokkeerd === 'true',
                'image_url' => trim((string) $node->Link_productfoto_webshop) ?: null,
                'data' => json_encode(collect(self::DATA_FIELDS)
                    ->mapWithKeys(fn ($field) => [$field => trim((string) $node->{$field})])
                    ->filter()
                    ->all(), JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($batch) === 500) {
                $count += $this->flush($batch);
            }
        }

        $count += $this->flush($batch);
        $reader->close();

        $this->info("{$count} artikelen geïmporteerd.");

        return self::SUCCESS;
    }

    private function flush(array &$batch): int
    {
        if ($batch === []) {
            return 0;
        }

        Product::upsert($batch, ['sku'], ['name', 'price', 'stock', 'discontinued', 'blocked', 'image_url', 'data', 'updated_at']);
        $count = count($batch);
        $batch = [];

        return $count;
    }
}
