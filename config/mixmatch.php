<?php

return [

    // AccountView-export met alle artikelen en verkoopprijzen.
    'products_xml' => env('MIXMATCH_PRODUCTS_XML', base_path('../products.xml')),

    // Sku die op de stuklijst komt als Maretti de armatuur monteert (nog te bevestigen door Maretti).
    'assembly_sku' => env('MIXMATCH_ASSEMBLY_SKU', '99.9006.00'),

    // Standaard snoerlengtes in meters. Andere lengtes kan alleen via een offerte.
    'cable_lengths' => [1.5, 3],

    // Grenzen voor een snoer op maat (per glas te overschrijven met meta cable_min / cable_max), bijvoorbeeld Glass Jewel 0,5 tot 6 meter.
    'cable_min' => 0.5,
    'cable_max' => 6,

    // Drivers voor de Milliamps-lampen (Glass Jewel en Barca), opgegeven door Maretti.
    // per_lamp: één driver per armatuur (lamp); anders zoveel lampen per driver als het wattbereik toelaat.
    // Het wattbereik haalt de seeder uit de naam in AccountView.
    'drivers' => [
        '16.8408.0350.00' => ['dimming' => 'Fase aan- en afsnijding (wanddimmer)', 'per_lamp' => true],  // 350mA 0,7-2,1W 2-6VDC L,C dimbaar P&P 30cm kabel
        '16.7016.0350.Z' => ['dimming' => 'DALI', 'per_lamp' => false],                                  // DALI-2 LP 350mA 3,2-14,7W P&P, meerdere armaturen per driver
    ],

    'magento' => [
        'base_url' => env('MAGENTO_BASE_URL', 'https://www.maretti.com'),
        // Controller van de (nog te bouwen) Magento-module die de configuratie in de winkelmand zet.
        'cart_path' => env('MAGENTO_MIXMATCH_CART_PATH', '/mixmatch/cart/add'),
        // Gedeeld geheim tussen Laravel en de Magento-module om de link te ondertekenen.
        'shared_secret' => env('MAGENTO_MIXMATCH_SECRET'),
    ],

    'accountview' => [
        // Map waar de orderbestanden voor AccountView worden neergezet.
        'export_path' => env('ACCOUNTVIEW_EXPORT_PATH', storage_path('app/exports/accountview')),
    ],

];
