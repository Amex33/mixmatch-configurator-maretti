<?php

namespace Database\Seeders;

use App\Models\ComponentOption;
use App\Models\Configurator;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Alle keuzes en regels uit de Mix & Match-catalogus (MED/Mix&Match.pdf, p. 222-243).
 */
class MixMatchSeeder extends Seeder
{
    private const COLORS = ['20' => 'koper', '98' => 'smoke', '55' => 'cognac'];

    // Textielsnoer per meter dat de klant in plaats van het standaardsnoer kan kiezen (foto's in images/configurator/kabel).
    private const CABLES = ['20.9860.04', '20.9861.04', '20.9861.05', '20.9870.04.D', '20.9870.04.E', '20.9871.04.D', '20.9871.05', '20.9872.01', '20.9872.04'];

    public function run(): void
    {
        $this->smallLine();
        $this->largeLine();
        $this->milliampLine();
    }

    private function smallLine(): void
    {
        $configurator = $this->configurator('230v-small', '230V Small', 1, [
            'voltage' => '230V',
            'glass_mode' => 'single',
        ]);

        $glass = [];
        foreach (self::COLORS as $code => $color) {
            $glass[] = $this->glass("tulip-s-{$color}", "Tulip S {$color}", 'Tulip', "80.1200.{$code}", $color, 'tulip', 'E27', 20, 200, 150, '21.9145.45', 'e27-cotton',
                ['size' => 'Ø20 cm', 'image' => $this->photo("13.0300.{$code}")]);
        }
        // Tulip ook in M en L (de glazen uit 230V Large), zodat je maten kunt kiezen en combineren.
        foreach (['M' => ['04', '03', 300, 250], 'L' => ['08', '06', 400, 345]] as $size => [$glassCode, $photoCode, $d, $h]) {
            foreach (self::COLORS as $code => $color) {
                $glass[] = $this->glass('tulip-'.strtolower($size)."-{$color}", "Tulip {$size} {$color}", 'Tulip', "80.12{$glassCode}.{$code}", $color, 'tulip', 'E27', 20, $d, $h,
                    '21.9151.45', 'e27-cotton', ['size' => 'Ø'.($d / 10).' cm', 'image' => $this->photo("13.03{$photoCode}.{$code}")]);
            }
        }
        foreach (self::COLORS as $code => $color) {
            $glass[] = $this->glass("icosa-{$color}", "Icosa {$color}", 'Icosa', "80.1220.{$code}", $color, 'icosa', 'E27', 20, 165, 280, '21.9153.45', 'e27-cotton',
                ['image' => $this->photo("13.0600.{$code}")]);
        }
        // Alleen 13.1870.04 (zwart/smoke) bestaat in AccountView.
        foreach (['91' => 'helder', '04' => 'smoke', '55' => 'cognac'] as $code => $color) {
            $glass[] = $this->glass("inciso-{$color}", "Inciso {$color}", 'Inciso', "13.1870.{$code}", $color, 'inciso', 'G9', 5, 150, 150, '21.8251.82.A', 'g9-cotton',
                ['image' => $this->photo("13.1870.{$code}")]);
        }
        foreach (['91' => 'helder', '98' => 'smoke', '90' => 'mat'] as $code => $color) {
            $glass[] = $this->glass("icon-{$color}", "Icon {$color}", 'Icon', "13.0400.{$code}", $color, 'icon', 'E27', 20, 50, 400, '21.9155.45.A', 'e27-cotton-icon',
                ['image' => $this->photo("13.0400.{$code}")]);
        }
        foreach (['45' => 'amber', '91' => 'helder', '98' => 'smoke'] as $code => $color) {
            $glass[] = $this->glass("johnnie-{$color}", "Johnnie {$color}", 'Johnnie', "80.1420.{$code}", $color, 'tulip', 'E27', 20, 90, 120, '21.9145.45', 'e27-cotton',
                ['image' => $this->photo("13.0480.{$code}")]);
        }

        // Paradiso en Zen zijn complete hanglampen (glas en snoer, bij Paradiso ook de lichtbron): geen losse pendel.
        // Eén product met twee keuzes: maat (meta.size) en kleur van glas en houder.
        foreach (['6880' => ['smoke', 170], '6883' => ['opaal', 170], '6890' => ['smoke', 250], '6893' => ['opaal', 250]] as $model => [$glassColor, $d]) {
            foreach (['04' => 'zwart', '11' => 'messing'] as $code => $holder) {
                $color = "{$glassColor}-{$holder}";
                $glass[] = $this->glass("paradiso-{$d}-{$color}", 'Paradiso Ø'.($d / 10)." cm {$glassColor}/{$holder}", 'Paradiso', "13.{$model}.{$code}", $color, 'inciso', 'G9', 3, $d, $d,
                    null, null, ['pendant_included' => true, 'size' => 'Ø'.($d / 10).' cm', 'color_label' => "{$glassColor} glas, {$holder}", 'image' => $this->photo("13.{$model}.{$code}")]);
            }
        }
        // Zen: één product, je kiest de vorm.
        foreach (['400.0009.05' => [350, 280], '400.0010.05' => [440, 490], '400.0011.05' => [480, 240]] as $sku => [$d, $h]) {
            $glass[] = $this->glass("zen-{$d}", 'Zen Ø'.($d / 10).' x '.($h / 10).' cm wit', 'Zen', $sku, 'wit', 'tommy', 'E27', 20, $d, $h,
                '21.9141.45', null, ['pendant_included' => true, 'size' => 'Ø'.($d / 10).' x '.($h / 10).' cm', 'size_label' => 'Vorm', 'image' => $this->photo($sku)]);
        }
        $glass[] = $this->glass('icon-qf-smoke', 'Icon QF smoke', 'Icon QF', '80.1271.98', 'smoke', 'icon', 'E27', 20, 120, 400,
            '21.9155.45.A', null, ['pendant_included' => true, 'image' => $this->photo('80.1271.98')]);
        foreach (['01' => 'goud', '55' => 'cognac'] as $code => $color) {
            $glass[] = $this->glass("ozone-{$color}", "Ozone {$color}", 'Ozone', "80.1275.{$code}", $color, 'icon', 'E27', 20, 60, 460,
                '21.9158.45', null, ['pendant_included' => true, 'image' => $this->photo("80.1275.{$code}")]);
        }
        // Rivington Tube los of met de perforatiebuis 13.3568.04 (apart artikel, komt als extra regel op de stuklijst).
        foreach (['zwart' => [[], '13.3565.04'], 'zwart met perfo' => [['13.3568.04'], '13.3565.04_perfo']] as $color => [$extras, $image]) {
            $glass[] = $this->glass('rivington-'.str_replace(' ', '-', $color), "Rivington Tube {$color}", 'Rivington Tube', '13.3565.04', $color, 'icon', 'E27', 20, 45, 400,
                '21.9155.45.A', null, ['pendant_included' => true, 'extra_skus' => $extras, 'image' => $this->photo($image)]);
        }
        // Venetian: albasten bol, je kiest de maat en de kleur van de houder (Ø10 cm alleen in zwart).
        foreach (['13.2570.04.A' => [100, 'zwart'], '13.2573.03.A' => [150, 'brons'], '13.2573.04.A' => [150, 'zwart']] as $sku => [$d, $holder]) {
            $glass[] = $this->glass("venetian-{$d}-{$holder}", 'Venetian Ø'.($d / 10)." cm {$holder} met albast", 'Venetian', $sku, $holder, 'inciso', 'G9', 3, $d, $d,
                '21.8250.92', null, ['pendant_included' => true, 'size' => 'Ø'.($d / 10).' cm', 'color_label' => "{$holder} met albast", 'finish' => 'albast',
                    'image' => $this->photo($sku)]);
        }

        $this->components($configurator, $glass, [
            ...$this->pendants('e27-cotton', 'E27 zwart katoen', 'E27', '70.5901.04.A', '70.5904.04'),
            ...$this->pendants('e27-cotton-icon', 'E27 zwart katoen', 'E27', '70.5991.04', '70.5995.04'),
            ...$this->pendants('g9-cotton', 'G9 zwart katoen', 'G9', '70.6001.04', '70.6005.04'),
        ], $this->roundAndPlateBases([
            'canopy1' => '70.5101.04', 'spreader3' => '70.5103.04', 'spreader9' => '70.5109.04', 'spreader12' => '70.5112.04',
            'spider9' => '70.5239.04', 'spider15' => '70.5245.04',
            'square9' => '70.5160.04.A', 'round9' => '70.5159.04.A', 'square16' => '70.5175.04.A', 'round16' => '70.5174.04.A',
            'rect3' => '70.5134.04', 'rect5' => '70.5136.04', 'rect10' => '70.5150.04.A', 'rect15' => '70.5168.04',
        ], assemblyRequiredForAll: false), $this->allCompositions());
    }

    private function largeLine(): void
    {
        $configurator = $this->configurator('230v-large', '230V Large', 2, [
            'voltage' => '230V',
            // Bij Large kies je per positie een maat (S/M/L), met een advies per plafondplaat.
            'glass_mode' => 'sizes',
        ]);

        $glass = [];
        foreach (['S' => ['00', 200, 150], 'M' => ['04', 300, 250], 'L' => ['08', 400, 345]] as $size => [$offset, $d, $h]) {
            foreach (self::COLORS as $code => $color) {
                $glass[] = $this->glass("tulip-{$size}-{$color}", "Tulip {$size} {$color}", 'Tulip', "80.12{$offset}.{$code}", $color, 'tulip', 'E27', 20, $d, $h,
                    $size === 'S' ? '21.9145.45' : '21.9151.45', 'e27-cotton',
                    ['size' => $size, 'image' => $this->photo('13.03'.['S' => '00', 'M' => '03', 'L' => '06'][$size].".{$code}")]);
            }
        }
        foreach (['S' => ['20', 165, 280], 'M' => ['24', 225, 215], 'L' => ['28', 340, 225]] as $size => [$offset, $d, $h]) {
            foreach (self::COLORS as $code => $color) {
                $glass[] = $this->glass("icosa-{$size}-{$color}", "Icosa {$size} {$color}", 'Icosa', "80.12{$offset}.{$code}", $color, 'icosa', 'E27', 20, $d, $h,
                    $size === 'S' ? '21.9153.45' : '21.9151.45', 'e27-cotton',
                    ['size' => $size, 'image' => $this->photo('13.06'.['S' => '00', 'M' => '03', 'L' => '06'][$size].".{$code}")]);
            }
        }
        // Sliced zwart/goud met ingebouwde pendel; lichtbron 21.9124.90 (opvolger van 21.9111.90 uit de catalogus, die is uitlopend).
        foreach (['S' => ['60.0379.150.A', 210, 260], 'M' => ['60.0381.150.A', 400, 330], 'L' => ['60.0382.150.A', 450, 270]] as $size => [$sku, $d, $h]) {
            $glass[] = $this->glass("sliced-{$size}", "Sliced {$size} zwart/goud", 'Sliced', $sku, 'zwart-goud', 'sliced', 'E27', 20, $d, $h,
                '21.9124.90', null, ['size' => $size, 'pendant_included' => true, 'image' => $this->photo($sku)]);
        }
        foreach (['XS' => ['60.2500.150', 27, 270, 170], 'S' => ['60.2520.150', 32, 320, 170], 'M' => ['60.2540.150', 45, 450, 170], 'L' => ['60.2560.150', 60, 600, 230]] as $size => [$sku, $n, $d, $h]) {
            $glass[] = $this->glass("tommy-{$n}", "Tommy {$n} zwart/goud", 'Tommy', $sku, 'zwart-goud', 'tommy', 'E27', 20, $d, $h,
                '21.9113.91', null, ['size' => $size, 'pendant_included' => true, 'image' => $this->photo($sku)]);
        }

        // Advies-indeling uit de catalogus; voor 3L, 5L, 9L en 11L is de volgorde een eerste voorstel (te controleren).
        $bases = [
            $this->base('rect3', '3-lichts plaat 670 x 100', '70.5134.04', 'plate', 3, 'rect', ['width' => 670, 'depth' => 100, 'spacing' => 280, 'advised_sizes' => ['M', 'L', 'M']]),
            $this->base('rect5', '5-lichts plaat 1300 x 100', '70.5136.04', 'plate', 5, 'rect', ['width' => 1300, 'depth' => 100, 'spacing' => 280, 'advised_sizes' => ['S', 'M', 'L', 'M', 'S']]),
            $this->base('rect7', '7-lichts plaat 1800 x 450', '70.5165.04.A', 'plate', 7, 'rect', ['width' => 1800, 'depth' => 450, 'advised_sizes' => ['L', 'M', 'S', 'L', 'S', 'M', 'L']]),
            $this->base('rect9', '9-lichts plaat 2200 x 500', '70.5162.04', 'plate', 9, 'rect', ['width' => 2200, 'depth' => 500, 'advised_sizes' => ['L', 'M', 'S', 'L', 'M', 'S', 'L', 'M', 'L']]),
            $this->base('rect11', '11-lichts plaat 2400 x 600', '70.5152.04', 'plate', 11, 'rect', ['width' => 2400, 'depth' => 600, 'advised_sizes' => ['S', 'M', 'L', 'S', 'M', 'L', 'M', 'S', 'L', 'M', 'S']]),
        ];

        $this->components($configurator, $glass,
            $this->pendants('e27-cotton', 'E27 zwart katoen', 'E27', '70.5901.04.A', '70.5904.04'),
            $bases,
            [$this->composition('random', 'Random', ['rect', 'square', 'round'])]);
    }

    private function milliampLine(): void
    {
        $configurator = $this->configurator('milliamps', 'Milliamps', 3, [
            'voltage' => 'mA',
            'glass_mode' => 'single',
        ]);

        // Bij Milliamps zit het glas aan de pendel vast: de pendel-sku bevat het glas, het glas zelf heeft geen sku.
        $glass = [
            $this->glass('jewel-s-brons', 'Glass Jewel small brons', 'Glass Jewel', null, 'brons', 'jewel', 'LED', 1, 110, 150, null, 'jewel-s-brons', ['size' => 'Ø11 cm', 'image' => $this->photo('13.1369.03')]),
            $this->glass('jewel-l-brons', 'Glass Jewel large brons', 'Glass Jewel', null, 'brons', 'jewel', 'LED', 1, 170, 190, null, 'jewel-l-brons', ['size' => 'Ø17 cm', 'image' => $this->photo('13.1370.03')]),
            $this->glass('jewel-s-chroom', 'Glass Jewel small chroom', 'Glass Jewel', null, 'chroom', 'jewel', 'LED', 1, 110, 150, null, 'jewel-s-chroom', ['size' => 'Ø11 cm', 'image' => $this->photo('13.1369.02')]),
            $this->glass('jewel-l-chroom', 'Glass Jewel large chroom', 'Glass Jewel', null, 'chroom', 'jewel', 'LED', 1, 170, 190, null, 'jewel-l-chroom', ['size' => 'Ø17 cm', 'image' => $this->photo('13.1370.02')]),
            $this->glass('barca', 'Barca pipe', 'Barca', null, 'helder', 'barca', 'LED', 1, 35, 340, null, 'barca', ['image' => 'barca_pipe']),
        ];

        // Complete LED-hanglampen op 350 mA (lichtbron en snoer inbegrepen, driver apart): geen losse pendel of lichtbron.
        // Soffio: één product, met of zonder DALI-dimming (13.2506 standaard, 13.2507 DALI).
        foreach (['2506' => ['', 'Standaard'], '2507' => ['-dali', 'DALI']] as $model => [$suffix, $version]) {
            foreach (['40' => 'rood', '45' => 'amber', '53' => 'bruin', '70' => 'blauw', '91' => 'helder'] as $code => $color) {
                $glass[] = $this->glass("soffio{$suffix}-{$color}", trim("Soffio {$color} ".($suffix ? 'DALI' : '')), 'Soffio', "13.{$model}.{$code}.B", $color, 'inciso', 'LED', 4, 150, 150,
                    null, null, ['pendant_included' => true, 'size' => $version, 'size_label' => 'Uitvoering', 'image' => $this->photo("13.{$model}.{$code}.B")]);
            }
        }
        // Hortense aan een plafondbasis: de pendelsets 70.01xx (incl. 3 m snoer), per positie een tak met 1, 3, 5 of 7 bloemen.
        // De keuze is het aantal lichten in plaats van een kleur; de afwerking is altijd brons. Foto's van de complete hanglampen 13.099x.
        foreach (['70.0113.03.A' => [3, '13.0993.03'], '70.0115.03.A' => [5, '13.0995.03'], '70.0117.03.A' => [7, '13.0997.03'], '70.0111.03' => [1, null]] as $sku => [$n, $photo]) {
            $glass[] = $this->glass("hortense-{$n}", "Hortense {$n}-lichts brons", 'Hortense', $sku, "{$n}-lichts", 'jewel', 'LED', 1, 400, 350,
                null, null, ['pendant_included' => true, 'cable_length' => 3, 'finish' => 'brons', 'option_label' => 'Aantal lichten',
                    'image' => $photo ? $this->photo($photo) : null]);
        }
        $glass[] = $this->glass('felice-rosegoud', 'Felice rosé goud', 'Felice', '400.0002.06', 'rosegoud', 'jewel', 'LED', 5, 100, 120,
            null, null, ['pendant_included' => true, 'image' => $this->photo('400.0002.06')]);
        $glass[] = $this->glass('cristallo-zwart', 'Cristallo zwart', 'Cristallo', '400.0001.80.A', 'kristal', 'jewel', 'LED', 3, 90, 135,
            null, null, ['pendant_included' => true, 'image' => $this->photo('400.0001.80.A')]);
        foreach (['13.1521.03.C' => 'brons', '13.1521.04.B' => 'gunmetal'] as $sku => $color) {
            $glass[] = $this->glass("bo-{$color}", "Bo {$color}", 'Bo', $sku, $color, 'icon', 'LED', 4, 47, 800,
                null, null, ['pendant_included' => true, 'image' => $this->photo($sku)]);
        }

        $this->components($configurator, $glass, [
            ...$this->pendants('jewel-s-brons', 'Zwart gedraaid, incl. Glass Jewel small brons', 'LED', '70.5322.03', '70.5329.03', 'twisted'),
            ...$this->pendants('jewel-l-brons', 'Zwart gedraaid, incl. Glass Jewel large brons', 'LED', '70.5326.03', '70.5331.03', 'twisted'),
            ...$this->pendants('jewel-s-chroom', 'Zwart gedraaid, incl. Glass Jewel small chroom', 'LED', '70.5322.02', '70.5328.02', 'twisted'),
            ...$this->pendants('jewel-l-chroom', 'Zwart gedraaid, incl. Glass Jewel large chroom', 'LED', '70.5326.02', '70.5330.02', 'twisted'),
            ...$this->pendants('barca', 'Zwart katoen, incl. Barca pipe', 'LED', '70.5343.04.A', '70.5344.04'),
        ], array_map(
            // De 1-lichts canopy voor Milliamps heeft de driver al ingebouwd ("incl driver").
            fn (array $base) => $base['key'] === 'canopy1' ? [...$base, 'meta' => [...$base['meta'], 'includes_driver' => true]] : $base,
            $this->roundAndPlateBases([
                'canopy1' => '70.5102.04', 'spreader3' => '70.5104.04', 'spreader9' => '70.5110.04', 'spreader12' => '70.5113.04',
                'spider9' => '70.5240.04', 'spider15' => '70.5246.04',
                'square9' => '70.5161.04', 'round9' => '70.5158.04', 'square16' => '70.5176.04', 'round16' => '70.5173.04',
                'rect10' => '70.5151.04', 'rect15' => '70.5169.04',
            ], assemblyRequiredForAll: true),
        ), $this->allCompositions(), $this->drivers());
    }

    /**
     * Drivers uit config('mixmatch.drivers') met dimtype en of er één per armatuur nodig is.
     * Het wattbereik staat in de naam ("3,2-14,7W", of in volt: "30-42V" x 0,35 A); bij een DUO-driver telt het maximum dubbel.
     */
    private function drivers(): array
    {
        return collect(config('mixmatch.drivers'))->map(function (array $settings, string $sku) {
            $name = Product::where('sku', $sku)->value('name') ?? $sku;
            $num = fn (string $v) => (float) str_replace(',', '.', $v);
            [$min, $max] = preg_match('/(\d+(?:[,.]\d+)?)-(\d+(?:[,.]\d+)?)\s*W/i', $name, $w) ? [$num($w[1]), $num($w[2])]
                : (preg_match('/(\d+(?:[,.]\d+)?)-(\d+(?:[,.]\d+)?)\s*V/i', $name, $v) ? [$num($v[1]) * 0.35, $num($v[2]) * 0.35] : [0.0, 8.0]);
            if (preg_match('/DUO|2x/i', $name)) {
                $max *= 2;
            }

            return ['key' => $sku, 'name' => $name, 'group' => $settings['dimming'], 'sku' => $sku, 'meta' => [
                'min_w' => round($min, 2), 'max_w' => round($max, 2), 'dimming' => $settings['dimming'], 'per_lamp' => (bool) ($settings['per_lamp'] ?? false),
            ]];
        })->values()->all();
    }

    // ---------------------------------------------------------------------

    private function configurator(string $slug, string $name, int $sort, array $settings): Configurator
    {
        return Configurator::updateOrCreate(['slug' => $slug], ['name' => $name, 'sort' => $sort, 'settings' => $settings, 'active' => true]);
    }

    private function components(Configurator $configurator, array $glass, array $pendants, array $bases, array $compositions, array $drivers = []): void
    {
        $steps = [
            ['glass', 'Glas of kap', 'Kies het glas of de kap voor je armatuur.', $glass],
            ['bulb', 'Lichtbron', 'Kies de lamp die in de fitting van je glas past. Wij adviseren de gemarkeerde lamp.', $this->bulbs()],
            ['pendant', 'Pendel', 'Snoerlengte is de afstand tussen het plafond en de onderkant van het laagste glas. Standaard 1,5 of 3 meter; andere lengtes op aanvraag.', $pendants],
            ['base', 'Plafondbasis', 'Het aantal lichten van de basis bepaalt hoeveel pendels je armatuur heeft.', $bases],
            // Alleen bij Milliamps: de LED-lampen hebben een driver nodig, afhankelijk van het aantal lampen en hoe je wilt dimmen.
            ...($drivers ? [['driver', 'Driver', 'De driver voedt de LED-lampen. Kies hoe je wilt dimmen; wij berekenen hoeveel drivers er nodig zijn.', $drivers]] : []),
            ['composition', 'Compositie', 'Hoe de glazen ten opzichte van elkaar hangen.', $compositions],
            ['assembly', 'Montage', 'Zelf samenstellen of laten monteren door Maretti Lighting.', [
                ['key' => 'self', 'name' => 'Zelf samenstellen', 'meta' => []],
                ['key' => 'maretti', 'name' => 'Montage door Maretti', 'meta' => []],
            ]],
            // Geen eigen stap: de snoerkeuze staat in de stap Pendel.
            ['cable', 'Snoer', 'Ander snoer in plaats van het standaardsnoer van de pendel.', $this->cables()],
        ];

        foreach ($steps as $i => [$key, $name, $description, $options]) {
            $component = $configurator->components()->updateOrCreate(['key' => $key], ['name' => $name, 'description' => $description, 'step' => $i + 1]);

            foreach ($options as $sort => $option) {
                // Via het model, niet via $component->options(): die toont alleen actieve opties, en een eerder uitgezette optie moet weer aan kunnen.
                ComponentOption::updateOrCreate(['configurator_component_id' => $component->id, 'key' => $option['key']], [...$option, 'sort' => $sort, 'active' => true]);
            }

            // Wat niet meer in deze seeder staat, verdwijnt uit de configurator (bewaard voor oude configuraties).
            $component->options()->whereNotIn('key', array_column($options, 'key'))->update(['active' => false]);
        }
    }

    private function glass(string $key, string $name, string $family, ?string $sku, string $color, string $shape, string $fitting, int $maxWatt,
        int $diameter, int $height, ?string $bulb, ?string $pendantGroup, array $extra = []): array
    {
        return [
            'key' => $key,
            'name' => $name,
            'group' => $family,
            'sku' => $sku,
            'meta' => [
                'color' => $color,
                'shape' => $shape,
                'fitting' => $fitting,
                'max_watt' => $maxWatt,
                'diameter' => $diameter,
                'height' => $height,
                'bulb_sku' => $bulb,
                'pendant_group' => $pendantGroup,
                // Kleur voor het 3D-voorbeeld, gemeten op de productfoto.
                'tint' => $this->tint($extra['image'] ?? null),
                ...$extra,
            ],
        ];
    }

    private function pendants(string $group, string $name, string $fitting, string $sku15, string $sku3, string $cable = 'cotton'): array
    {
        return [
            ['key' => "{$group}-1.5", 'name' => "{$name}, 1,5 m", 'group' => $group, 'sku' => $sku15,
                'meta' => ['pendant_group' => $group, 'length' => 1.5, 'fitting' => $fitting, 'cable' => $cable]],
            ['key' => "{$group}-3", 'name' => "{$name}, 3 m", 'group' => $group, 'sku' => $sku3,
                'meta' => ['pendant_group' => $group, 'length' => 3.0, 'fitting' => $fitting, 'cable' => $cable]],
        ];
    }

    private function base(string $key, string $name, string $sku, string $type, int $lights, string $shape, array $meta = [], bool $assembly = false): array
    {
        return [
            'key' => $key,
            'name' => $name,
            'group' => $type,
            'sku' => $sku,
            'meta' => ['type' => $type, 'lights' => $lights, 'shape' => $shape, 'requires_assembly' => $assembly, 'image' => $this->drawing($sku),
                'finishes' => $this->finishes($sku), ...$meta],
        ];
    }

    /**
     * Kleur van de plafondbasis => sku. Zwart is de sku uit de catalogus, wit is hetzelfde model met .05 als dat in AccountView staat.
     * Brons en RVS bestaan (nog) niet als artikel: null betekent op aanvraag.
     */
    private function finishes(string $sku): array
    {
        $white = implode('.', array_slice(explode('.', $sku), 0, 2)).'.05';

        return ['zwart' => $sku, 'wit' => Product::where('sku', $white)->exists() ? $white : null, 'brons' => null, 'rvs' => null];
    }

    /**
     * Lampen uit public/images/configurator/fittings; fitting en naam komen uit products.xml (tabel products).
     */
    private function bulbs(): array
    {
        $bulbs = collect($this->images('fittings'))
            ->sort()
            ->map(function (string $sku) {
                $product = Product::where('sku', $sku)->first();
                $fitting = $product?->data['Fitting'] ?? (preg_match('/\b(E27|E14|G9|G4)\b/i', (string) $product?->name, $m) ? strtoupper($m[1]) : null);

                return ['key' => $sku, 'name' => $product?->name ?? $sku, 'group' => $fitting, 'sku' => $sku, 'meta' => ['fitting' => $fitting]];
            });

        return [...$bulbs->values(), ['key' => 'none', 'name' => 'Zonder lichtbron', 'meta' => []]];
    }

    /**
     * Het aantal aders staat in de AccountView-naam ("TEXTILE CABLE 3x 0,75 black"): 230V heeft 3 aders nodig, Milliamps 2.
     */
    private function cables(): array
    {
        return collect(self::CABLES)->map(function (string $sku) {
            $name = Product::where('sku', $sku)->value('name') ?? $sku;
            $cores = preg_match('/(\d)x\s*0[,.]\d+/i', $name, $m) ? (int) $m[1] : null;

            return ['key' => $sku, 'name' => $name, 'group' => $cores ? "{$cores}-aderig" : null, 'sku' => $sku, 'meta' => ['cores' => $cores]];
        })->all();
    }

    /**
     * Tekening van de plafondbasis in public/images/configurator/ceiling-base (uit de PDF-stickers).
     * Zwart en wit delen één tekening, dus zonder eigen bestand nemen we een andere kleur van hetzelfde model (70.5159.*).
     */
    private function drawing(string $sku): ?string
    {
        $model = implode('.', array_slice(explode('.', $sku), 0, 2));
        $names = $this->images('ceiling-base');

        return in_array($sku, $names, true) ? $sku : collect($names)->first(fn (string $name) => str_starts_with($name, "{$model}."));
    }

    /**
     * Gemiddelde kleur van het glas op de productfoto (mediaan, zonder witte achtergrond en zwart snoer).
     * Bij gekleurd glas tellen alleen de duidelijk gekleurde pixels, anders verdwijnt een klein rood glas in het grijs.
     */
    private function tint(?string $image): ?string
    {
        $file = $image ? collect(glob(public_path("images/configurator/*/{$image}.*")))->first() : null;
        $source = $file ? @imagecreatefromstring(file_get_contents($file)) : false;

        if (! $source) {
            return null;
        }

        $small = imagescale($source, 120);
        $all = $saturated = [];

        // Het bovenste deel van de foto is meestal snoer en plafondkap.
        for ($y = (int) (imagesy($small) * 0.3); $y < imagesy($small); $y++) {
            for ($x = 0; $x < imagesx($small); $x++) {
                $c = imagecolorat($small, $x, $y);
                $rgb = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];

                if (min($rgb) >= 215 || max($rgb) <= 25) {
                    continue;
                }

                $all[] = $rgb;

                if ((max($rgb) - min($rgb)) / max($rgb) > 0.25) {
                    $saturated[] = $rgb;
                }
            }
        }

        $pixels = count($saturated) >= 0.15 * count($all) ? $saturated : $all;

        return $pixels ? '#'.implode('', array_map(fn (int $k) => sprintf('%02x', collect(array_column($pixels, $k))->median()), [0, 1, 2])) : null;
    }

    /**
     * Bestandsnamen (zonder extensie) van de afbeeldingen in een map onder public/images/configurator.
     */
    private function images(string $folder): array
    {
        return collect(glob(public_path("images/configurator/{$folder}/*.*")))
            ->filter(fn (string $file) => in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['jpg', 'png', 'webp'], true))
            ->map(fn (string $file) => pathinfo($file, PATHINFO_FILENAME))
            ->values()->all();
    }

    /**
     * Spreaders, spiders en XL-plafondplaten zijn bij Small en Milliamps gelijk; alleen de sku's verschillen.
     */
    private function roundAndPlateBases(array $skus, bool $assemblyRequiredForAll): array
    {
        $all = [
            'canopy1' => ['1-lichts canopy', 'canopy', 1, 'round', ['canopy_diameter' => 100, 'compositions' => ['straight']], false],
            'spreader3' => ['3-lichts canopy met spreader Ø220', 'spreader', 3, 'round', ['canopy_diameter' => 120, 'diameter' => 220], false],
            'spreader9' => ['9-lichts canopy met spreader Ø660', 'spreader', 9, 'round', ['canopy_diameter' => 153, 'diameter' => 660], true],
            'spreader12' => ['12-lichts canopy met spreader Ø660', 'spreader', 12, 'round', ['canopy_diameter' => 153, 'diameter' => 660], true],
            'spider9' => ['9-lichts spider Ø600', 'spider', 9, 'round', ['diameter' => 600], true],
            'spider15' => ['15-lichts spider Ø1200', 'spider', 15, 'round', ['diameter' => 1200], true],
            'square9' => ['9-lichts plaat 450 x 450', 'plate', 9, 'square', ['width' => 450, 'depth' => 450, 'spacing' => 150], false],
            'round9' => ['9-lichts plaat rond Ø600', 'plate', 9, 'round', ['diameter' => 600, 'spacing' => 150], false],
            'square16' => ['16-lichts plaat 700 x 700', 'plate', 16, 'square', ['width' => 700, 'depth' => 700, 'spacing' => 165], false],
            'round16' => ['16-lichts plaat rond Ø750', 'plate', 16, 'round', ['diameter' => 750, 'spacing' => 170], false],
            'rect3' => ['3-lichts plaat 670 x 100', 'plate', 3, 'rect', ['width' => 670, 'depth' => 100, 'spacing' => 280], false],
            'rect5' => ['5-lichts plaat 1300 x 100', 'plate', 5, 'rect', ['width' => 1300, 'depth' => 100, 'spacing' => 280], false],
            'rect10' => ['10-lichts plaat 1200 x 300', 'plate', 10, 'rect', ['width' => 1200, 'depth' => 300, 'spacing' => 230], false],
            'rect15' => ['15-lichts plaat 1800 x 300', 'plate', 15, 'rect', ['width' => 1800, 'depth' => 300, 'spacing' => 230], false],
        ];

        return collect($skus)->map(function ($sku, $key) use ($all, $assemblyRequiredForAll) {
            [$name, $type, $lights, $shape, $meta, $assembly] = $all[$key];

            return $this->base($key, $name, $sku, $type, $lights, $shape, $meta, $assemblyRequiredForAll || $assembly);
        })->values()->all();
    }

    /**
     * Foto van de complete hanglamp in public/images/configurator/lampen; de bestanden heten soms sku.A, sku.B of sku_PD1.
     */
    private function photo(string $sku): ?string
    {
        foreach (['', '.A', '.B', '_PD1'] as $suffix) {
            foreach (['jpg', 'png', 'webp'] as $extension) {
                if (is_file(public_path("images/configurator/lampen/{$sku}{$suffix}.{$extension}"))) {
                    return $sku.$suffix;
                }
            }
        }

        return null;
    }

    private function composition(string $key, string $name, array $shapes): array
    {
        return ['key' => $key, 'name' => $name, 'meta' => ['shapes' => $shapes]];
    }

    private function allCompositions(): array
    {
        return [
            $this->composition('straight', 'Recht', ['rect']),
            $this->composition('random', 'Random', ['rect', 'square', 'round']),
            $this->composition('v-shape', 'V-vorm', ['rect', 'square', 'round']),
            $this->composition('swirl', 'Swirl', ['square', 'round']),
        ];
    }
}
