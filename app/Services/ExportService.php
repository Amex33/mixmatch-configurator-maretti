<?php

namespace App\Services;

use App\Models\Configuration;
use Illuminate\Support\Facades\File;
use SimpleXMLElement;

/**
 * Zet een bestelde of goedgekeurde configuratie klaar voor AccountView.
 *
 * Voorlopig als XML-bestand in een importmap. Het exacte formaat stemmen we af
 * zodra bekend is hoe de Magento-orders nu in AccountView komen.
 */
class ExportService
{
    public function toAccountView(Configuration $configuration): string
    {
        $configuration->loadMissing('items', 'configurator');

        $xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><Order/>');
        $this->add($xml, 'Referentie', $configuration->uuid);
        $this->add($xml, 'Bron', 'Mix & Match configurator');
        $this->add($xml, 'Lijn', $configuration->configurator->name);
        $this->add($xml, 'Status', $configuration->status);
        $this->add($xml, 'MagentoOrder', $configuration->magento_order_id);
        $this->add($xml, 'Datum', now()->toDateString());

        $customer = $xml->addChild('Klant');
        foreach ((array) $configuration->customer as $field => $value) {
            $this->add($customer, ucfirst($field), $value);
        }

        $lines = $xml->addChild('Regels');
        foreach ($configuration->items as $item) {
            $line = $lines->addChild('Regel');
            $this->add($line, 'Artikel', $item->sku);
            $this->add($line, 'Omschrijving', $item->description);
            $this->add($line, 'Aantal', $item->quantity);
            $this->add($line, 'Prijs', $item->unit_price);
        }

        $directory = config('mixmatch.accountview.export_path');
        File::ensureDirectoryExists($directory);
        $path = $directory.DIRECTORY_SEPARATOR.'mixmatch-'.$configuration->uuid.'.xml';
        File::put($path, $xml->asXML());

        $configuration->update(['status' => Configuration::STATUS_EXPORTED, 'exported_at' => now()]);

        return $path;
    }

    /**
     * Via de array-toewijzing escapet SimpleXML tekens als & zelf.
     */
    private function add(SimpleXMLElement $parent, string $name, mixed $value): void
    {
        $parent->addChild($name)[0] = (string) $value;
    }
}
