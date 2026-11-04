<?php

namespace App\Services;

use App\Models\Configuration;
use RuntimeException;

/**
 * Koppeling met Magento. Niet alle onderdelen staan in Magento, daarom gaat de configuratie
 * als één product "Mix & Match configuratie" in de winkelmand, met de stuklijst erbij.
 *
 * Werking:
 *  1. Laravel geeft een ondertekende link naar de Magento-module (cartUrl).
 *  2. De module haalt de configuratie op via GET /api/configurations/{uuid}, controleert de handtekening
 *     en zet het product met totaalprijs en stuklijst in de winkelmand van de bezoeker.
 *  3. Na de bestelling meldt de module dat via POST /api/magento/order-placed (ook ondertekend).
 */
class MagentoService
{
    public function cartUrl(Configuration $configuration, int $ttlMinutes = 30): string
    {
        $expires = now()->addMinutes($ttlMinutes)->timestamp;

        $query = http_build_query([
            'configuration' => $configuration->uuid,
            'expires' => $expires,
            'signature' => $this->sign($configuration->uuid.'|'.$expires),
        ]);

        return rtrim(config('mixmatch.magento.base_url'), '/').config('mixmatch.magento.cart_path').'?'.$query;
    }

    public function verify(string $payload, ?string $signature): bool
    {
        return $signature !== null && hash_equals($this->sign($payload), $signature);
    }

    private function sign(string $payload): string
    {
        $secret = config('mixmatch.magento.shared_secret');

        if (blank($secret)) {
            throw new RuntimeException('MAGENTO_MIXMATCH_SECRET is niet ingesteld.');
        }

        return hash_hmac('sha256', $payload, $secret);
    }
}
