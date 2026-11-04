<?php

namespace Tests\Feature;

use App\Models\Configuration;
use App\Models\Product;
use Database\Seeders\MixMatchSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class MixMatchConfiguratorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            '80.1255.98' => 21.45, '70.6001.04' => 21.07, '70.5245.04' => 693.39,
            '70.5103.04' => 60.00, '99.9006.00' => 46.20, '60.2500.150' => 150.00, '60.2540.150' => 200.00,
            '60.2560.150' => 250.00, '70.5165.04.A' => 400.00, '70.5104.04' => 80.00,
        ] as $sku => $price) {
            Product::create(['sku' => $sku, 'name' => $sku, 'price' => $price]);
        }

        // Lampen vóór het seeden, want de seeder haalt de fitting uit products.xml.
        foreach (['21.8251.82.A' => [14.83, 'G9'], '21.8250.92' => [9.50, 'G9'], '21.9124.90' => [13.18, 'E27'], '21.9113.91' => [10.00, 'E27']] as $sku => [$price, $fitting]) {
            Product::create(['sku' => $sku, 'name' => $sku, 'price' => $price, 'data' => ['Fitting' => $fitting]]);
        }

        $this->seed(MixMatchSeeder::class);

        config(['mixmatch.magento.shared_secret' => 'test-secret', 'mixmatch.accountview.export_path' => storage_path('framework/testing/accountview')]);
    }

    public function test_catalogue_example_builds_the_expected_bill_of_materials(): void
    {
        // Voorbeeld uit de catalogus: Inciso smoke, G9-pendel, spider 15L, V-vorm.
        $response = $this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => 'inciso-smoke', 'length' => 1.5, 'base' => 'spider15', 'composition' => 'v-shape', 'assembly' => 'self',
        ])->assertOk();

        $items = collect($response->json('items'))->keyBy('role');

        $this->assertTrue($response->json('valid'));
        $this->assertSame(15, $items['glass']['quantity']);
        $this->assertSame('70.6001.04', $items['pendant']['sku']);
        $this->assertSame(15, $items['bulb']['quantity']);
        $this->assertSame('70.5245.04', $items['base']['sku']);
        // De 15L spider moet altijd door Maretti gemonteerd worden, ook als de klant "zelf" kiest.
        $this->assertSame('99.9006.00', $items['assembly']['sku']);
        $this->assertSame(1599.84, $response->json('total'));
        $this->assertSame('Deze plafondbasis wordt altijd door Maretti gemonteerd.', $response->json('availability.assembly.self'));
    }

    public function test_straight_composition_is_not_allowed_on_a_round_base(): void
    {
        $this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => 'inciso-smoke', 'length' => 3, 'base' => 'spider15', 'composition' => 'straight', 'assembly' => 'maretti',
        ])->assertOk()
            ->assertJsonPath('valid', false)
            ->assertJsonPath('errors.0', 'Recht past niet bij een ronde plafondbasis.')
            ->assertJsonPath('items.1.sku', '70.6005.04');
    }

    public function test_large_line_mixes_sizes_and_skips_pendant_for_tommy_shades(): void
    {
        $response = $this->postJson('/api/configurators/230v-large/pricing', [
            'glass' => ['tommy-60', 'tommy-45', 'tommy-27', 'tommy-60', 'tommy-27', 'tommy-45', 'tommy-60'],
            'base' => 'rect7', 'composition' => 'random', 'assembly' => 'self',
        ])->assertOk()->assertJsonPath('valid', true);

        $items = collect($response->json('items'));

        $this->assertFalse($items->contains('role', 'pendant'), 'Bij Tommy zit de pendel bij de kap.');
        $this->assertSame(3, $items->firstWhere('sku', '60.2560.150')['quantity']);
        $this->assertSame(7, $items->firstWhere('role', 'bulb')['quantity']);
        $this->assertFalse($items->contains('role', 'assembly'));
    }

    public function test_customer_can_choose_a_bulb_that_fits_the_glass(): void
    {
        $price = fn (array $extra) => collect($this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => 'inciso-smoke', 'length' => 1.5, 'base' => 'spider15', 'composition' => 'v-shape', 'assembly' => 'self', ...$extra,
        ])->assertOk()->json('items'))->firstWhere('role', 'bulb');

        $this->assertSame('21.8251.82.A', $price([])['sku'], 'Zonder keuze krijg je het advies bij het glas.');
        $this->assertSame('21.8250.92', $price(['bulb' => '21.8250.92'])['sku']);
        $this->assertSame('21.8251.82.A', $price(['bulb' => '21.9124.90'])['sku'], 'Een E27-lamp past niet in een G9-fitting.');
        $this->assertNull($price(['bulb' => 'none']));

        $availability = $this->postJson('/api/configurators/230v-small/pricing', ['glass' => 'inciso-smoke', 'base' => 'spider15'])->json('availability.bulb');

        $this->assertSame('Past niet in de fitting van het gekozen glas.', $availability['21.9124.90']);
        $this->assertNull($availability['21.8250.92']);
    }

    public function test_hortense_hangs_on_a_ceiling_base_with_its_own_pendant_set(): void
    {
        Product::create(['sku' => '70.0117.03.A', 'name' => 'HORTENSE PENDANT 7-L bronze incl. 3m', 'price' => 751.24]);
        Product::create(['sku' => '16.7016.0350.Z', 'name' => 'DRIVER DALI-2 LP 350mA 3,2-14,7W P&P', 'price' => 57.81]);
        $this->seed(MixMatchSeeder::class);

        // Hortense valt onder Milliamps: drie takken van 7 bloemen aan een mA-spreader, geen losse pendel of lichtbron, wel basis en driver.
        $items = collect($this->postJson('/api/configurators/milliamps/pricing', [
            'glass' => 'hortense-7', 'base' => 'spreader3', 'driver' => '16.7016.0350.Z', 'composition' => 'random', 'assembly' => 'maretti',
        ])->assertOk()->assertJsonPath('valid', true)->json('items'));

        $this->assertSame([['70.0117.03.A', 3], ['70.5104.04', 1]], $items->whereIn('role', ['glass', 'base'])->map(fn ($i) => [$i['sku'], $i['quantity']])->values()->all());
        $this->assertTrue($items->contains('role', 'driver'));

        // Langer snoer kan, maar alleen op aanvraag.
        $this->postJson('/api/configurators/milliamps/pricing', ['glass' => 'hortense-7', 'base' => 'canopy1', 'length' => 'custom', 'custom_length' => 5, 'assembly' => 'maretti'])
            ->assertJsonPath('valid', true)->assertJsonPath('quote_only', true);
    }

    public function test_lamps_with_their_own_pendant_can_get_another_cable(): void
    {
        Product::create(['sku' => '20.9860.04', 'name' => 'TEXTILE CABLE 3x 0,75 black per meter', 'price' => 4.30]);
        $this->seed(MixMatchSeeder::class);

        // Ozone heeft een eigen pendel; 2 m ander snoer aan een spreader van 3 = 6 meter.
        $cable = collect($this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => 'ozone-goud', 'base' => 'spreader3', 'composition' => 'random', 'length' => 'custom', 'custom_length' => 2, 'cable' => '20.9860.04', 'assembly' => 'self',
        ])->assertJsonPath('valid', true)->json('items'))->firstWhere('role', 'cable');

        $this->assertSame(['20.9860.04', 6], [$cable['sku'], $cable['quantity']]);
    }

    public function test_rivington_with_perforated_tube_adds_the_tube_per_light(): void
    {
        $items = collect($this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => 'rivington-zwart-met-perfo', 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'self',
        ])->assertOk()->json('items'))->keyBy('role');

        $this->assertSame(['13.3565.04', 3], [$items['glass']['sku'], $items['glass']['quantity']]);
        $this->assertSame(['13.3568.04', 3], [$items['accessory']['sku'], $items['accessory']['quantity']]);

        $without = collect($this->postJson('/api/configurators/230v-small/pricing', ['glass' => 'rivington-zwart', 'base' => 'spreader3'])->json('items'));
        $this->assertFalse($without->contains('role', 'accessory'));
    }

    public function test_other_cable_is_charged_per_meter_and_limited_to_the_allowed_length(): void
    {
        foreach (['20.9872.04' => 'TEXTILE CABLE twisted 2x 0,75 black PVC', '20.9860.04' => 'TEXTILE CABLE 3x 0,75 black per meter'] as $sku => $name) {
            Product::create(['sku' => $sku, 'name' => $name, 'price' => 1.93]);
        }
        $this->seed(MixMatchSeeder::class);

        // Glass Jewel (Milliamps) aan een spreader van 3: 2,4 m twisted snoer per pendel = 7,2 m, afgerond 8 m.
        $response = $this->postJson('/api/configurators/milliamps/pricing', [
            'glass' => 'jewel-s-brons', 'length' => 'custom', 'custom_length' => 2.4, 'cable' => '20.9872.04',
            'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'maretti',
        ])->assertOk()->assertJsonPath('valid', true)->assertJsonPath('quote_only', true);

        $cable = collect($response->json('items'))->firstWhere('role', 'cable');
        $this->assertSame(['20.9872.04', 8], [$cable['sku'], $cable['quantity']]);

        // Een 3-aderig 230V-snoer past niet bij Milliamps, en meer dan 6 meter kan niet.
        $this->postJson('/api/configurators/milliamps/pricing', [
            'glass' => 'jewel-s-brons', 'length' => 'custom', 'custom_length' => 7, 'cable' => '20.9860.04', 'base' => 'spreader3', 'composition' => 'random',
        ])->assertJsonPath('valid', false)
            ->assertJsonFragment(['De snoerlengte moet tussen 0,5 en 6 meter liggen.'])
            ->assertJsonFragment(['Past niet bij Milliamps (2-aderig snoer nodig).']);
    }

    public function test_ceiling_base_color_uses_the_white_sku_and_bronze_is_on_request(): void
    {
        Product::create(['sku' => '70.5103.05', 'name' => 'CEILING BASE with SPREADER 3-L white', 'price' => 143.76]);
        Product::create(['sku' => '13.1870.04', 'name' => 'INCISO PENDANT 1-L black / smoke', 'price' => 93.35]);
        $this->seed(MixMatchSeeder::class);
        $selections = ['glass' => 'inciso-smoke', 'length' => 1.5, 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'self'];

        $white = $this->postJson('/api/configurators/230v-small/pricing', [...$selections, 'base_color' => 'wit'])->assertJsonPath('quote_only', false);
        $this->assertSame('70.5103.05', collect($white->json('items'))->firstWhere('role', 'base')['sku']);

        $bronze = $this->postJson('/api/configurators/230v-small/pricing', [...$selections, 'base_color' => 'brons'])->assertJsonPath('quote_only', true);
        $this->assertSame('70.5103.04', collect($bronze->json('items'))->firstWhere('role', 'base')['sku'], 'Op aanvraag: we rekenen met zwart.');
    }

    public function test_glasses_from_different_series_can_be_combined(): void
    {
        $items = collect($this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => ['tulip-s-koper', 'icosa-smoke', 'inciso-smoke'], 'length' => 1.5, 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'self',
        ])->assertOk()->json('items'));

        $this->assertEqualsCanonicalizing(['80.1200.20', '80.1220.98', '13.1870.04'], $items->where('role', 'glass')->pluck('sku')->all());
        // Elk glas zijn eigen pendel: E27 voor Tulip en Icosa, G9 voor Inciso.
        $this->assertEqualsCanonicalizing([['70.5901.04.A', 2], ['70.6001.04', 1]], $items->where('role', 'pendant')->map(fn ($i) => [$i['sku'], $i['quantity']])->values()->all());
    }

    public function test_led_lamps_and_lamps_with_a_fitting_cannot_be_combined(): void
    {
        // De complete LED-hanglampen (Soffio, Hortense, Felice, Cristallo, Bo) staan bij Milliamps, niet meer bij 230V Small.
        $small = $this->getJson('/api/configurators/230v-small')->json('components.0.options.*.group');
        $milliamps = $this->getJson('/api/configurators/milliamps')->json('components.0.options.*.group');
        foreach (['Soffio', 'Hortense', 'Felice', 'Cristallo', 'Bo'] as $family) {
            $this->assertNotContains($family, $small);
            $this->assertContains($family, $milliamps);
        }

        $this->postJson('/api/configurators/230v-small/pricing', [
            'glass' => ['tulip-s-koper', 'soffio-rood', 'tulip-s-koper'], 'length' => 1.5, 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'self',
        ])->assertJsonPath('valid', false);
    }

    public function test_milliamps_gets_a_driver_except_on_the_canopy_with_built_in_driver(): void
    {
        Product::create(['sku' => '16.7016.0350.Z', 'name' => 'DRIVER DALI-2 LP 350mA 3,2-14,7W P&P', 'price' => 57.81]);
        $this->seed(MixMatchSeeder::class);
        $selections = ['glass' => 'jewel-s-brons', 'length' => 1.5, 'composition' => 'random', 'assembly' => 'maretti'];

        // 9 lampen van 1 W: één DALI-driver van 3,2-14,7 W, als de klant DALI kiest.
        $driver = collect($this->postJson('/api/configurators/milliamps/pricing', [...$selections, 'base' => 'spreader9', 'driver' => '16.7016.0350.Z'])
            ->assertJsonPath('valid', true)->json('items'))->firstWhere('role', 'driver');
        $this->assertSame(['16.7016.0350.Z', 1], [$driver['sku'], $driver['quantity']]);

        $canopy = collect($this->postJson('/api/configurators/milliamps/pricing', [...$selections, 'base' => 'canopy1'])->json('items'));
        $this->assertFalse($canopy->contains('role', 'driver'), 'De 1-lichts canopy heeft de driver al ingebouwd.');
    }

    public function test_unknown_price_or_custom_length_forces_a_quote(): void
    {
        // De chromen Glass Jewel van 3 meter bestaat niet in AccountView.
        $this->postJson('/api/configurators/milliamps/pricing', [
            'glass' => 'jewel-s-chroom', 'length' => 3, 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'maretti',
        ])->assertJsonPath('quote_only', true);

        $configuration = $this->postJson('/api/configurations', [
            'configurator' => '230v-small',
            'selections' => ['glass' => 'inciso-smoke', 'length' => 'custom', 'custom_length' => 2.2, 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'self'],
        ])->assertCreated()->assertJsonPath('quote_only', true)->json('uuid');

        $this->postJson("/api/configurations/{$configuration}/cart")->assertStatus(422);

        $this->postJson("/api/configurations/{$configuration}/quote", ['name' => 'Test Klant', 'email' => 'klant@example.com'])
            ->assertOk()->assertJsonPath('status', Configuration::STATUS_QUOTE_REQUESTED);
    }

    public function test_incomplete_configuration_cannot_be_saved(): void
    {
        $this->postJson('/api/configurations', ['configurator' => '230v-small', 'selections' => ['glass' => 'inciso-smoke']])
            ->assertStatus(422)
            ->assertJsonFragment(['Kies een plafondbasis.']);
    }

    public function test_order_from_magento_is_exported_to_accountview(): void
    {
        $uuid = $this->postJson('/api/configurations', [
            'configurator' => '230v-small',
            'selections' => ['glass' => 'inciso-smoke', 'length' => 1.5, 'base' => 'spreader3', 'composition' => 'random', 'assembly' => 'self'],
        ])->assertCreated()->json('uuid');

        $url = $this->postJson("/api/configurations/{$uuid}/cart")->assertOk()->json('redirect_url');
        $this->assertStringStartsWith('https://www.maretti.com/mixmatch/cart/add?configuration='.$uuid, $url);

        $this->postJson('/api/magento/order-placed', ['configuration' => $uuid, 'order_id' => '100001234'], ['X-Mixmatch-Signature' => 'fout'])
            ->assertForbidden();

        $signature = hash_hmac('sha256', "{$uuid}|100001234", 'test-secret');
        $file = $this->postJson('/api/magento/order-placed', ['configuration' => $uuid, 'order_id' => '100001234'], ['X-Mixmatch-Signature' => $signature])
            ->assertOk()->json('exported_to');

        $xml = File::get(config('mixmatch.accountview.export_path').DIRECTORY_SEPARATOR.$file);
        $this->assertStringContainsString('<Bron>Mix &amp; Match configurator</Bron>', $xml);
        $this->assertStringContainsString('<Artikel>70.5103.04</Artikel>', $xml);
        $this->assertSame(Configuration::STATUS_EXPORTED, Configuration::where('uuid', $uuid)->value('status'));

        File::deleteDirectory(config('mixmatch.accountview.export_path'));
    }
}
