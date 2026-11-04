# Mix & Match configurator – Maretti Lighting

Configurator voor maretti.com/configurator, op basis van de catalogus `MED/Mix&Match.pdf`.
Laravel levert de regels, stuklijst en prijzen; React (in `resources/js/configurator`) toont de 5 stappen met 3D-voorbeeld.

## Lokaal starten

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed                 # lijnen, stappen en regels uit de catalogus
php artisan mixmatch:import-products       # artikelen + prijzen uit ../products.xml (AccountView)
npm run dev & php artisan serve            # http://localhost:8000/configurator
```

## Hoe het werkt

- `database/seeders/MixMatchSeeder.php` – alle keuzes en regels uit de catalogus (230V Small, 230V Large, Milliamps).
- `CompatibilityService` – welk glas bij welke pendel past, welke compositie bij welke basis, verplichte montage.
- `ConfigurationService` – maakt de stuklijst (glas, pendel, lamp, basis, montage) en slaat configuraties op.
- `PricingService` – prijzen uit de AccountView-export; ontbreekt een prijs, dan kan de configuratie alleen via een offerte.
- `MagentoService` – ondertekende link naar de (nog te bouwen) Magento-module die de configuratie in de winkelmand zet.
- `ExportService` – zet bestelde configuraties als XML klaar voor AccountView (formaat nog af te stemmen).

## API

| Methode | Pad | Doel |
|---|---|---|
| GET | `/api/configurators` | lijnen |
| GET | `/api/configurators/{slug}` | stappen, opties, prijzen |
| POST | `/api/configurators/{slug}/pricing` | stuklijst + prijs voor de huidige keuzes |
| POST | `/api/configurations` | configuratie opslaan |
| GET | `/api/configurations/{uuid}` | opgeslagen configuratie (ook voor de Magento-module) |
| POST | `/api/configurations/{uuid}/quote` | offerte aanvragen |
| POST | `/api/configurations/{uuid}/cart` | link naar Magento-winkelmand |
| POST | `/api/magento/order-placed` | melding van Magento na bestelling, daarna export naar AccountView |

## Nog te doen

- Magento-module `/mixmatch/cart/add` en de melding na bestelling.
- Offerte-PDF en e-mail naar klant en verkoop.
- Echte 3D-modellen (GLB) uit de SolidWorks/STEP-bestanden.
- Koppeling met AccountView volgens de bestaande werkwijze voor Magento-orders.
