import { useState } from 'react';
import { BASE_COLORS } from './baseColors';
import { MixEditor, SizeEditor } from './MaterialSelector';
import { formatPrice } from './PriceSummary';
import { glassPerPosition, isStandalone, options, useConfigurator } from './stores/configuratorStore';
import type { BaseColor, Option, StepKey } from './types';

const BASE_GROUPS: Record<string, string> = { canopy: 'Canopy', spreader: 'Canopy met spreader', spider: 'Spiders', plate: 'XL-plafondplaten' };

function Card({ option, selected, disabled, onSelect, children }: {
    option: Option;
    selected: boolean;
    disabled?: string | null;
    onSelect: () => void;
    children?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={!!disabled}
            title={disabled ?? undefined}
            className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selected ? 'border-gray-950 ring-1 ring-gray-950' : 'border-gray-200 hover:border-gray-400'
            }`}
        >
            {option.image && <img src={option.image} alt="" className="mb-2 aspect-square w-full rounded-lg bg-white object-contain" loading="lazy" />}
            <span className="block font-medium text-gray-950">{option.name}</span>
            {children}
            {option.sku && <span className="mt-1 block font-mono text-xs text-gray-400">{option.sku}</span>}
            {disabled && <span className="mt-1 block text-xs text-red-600">{disabled}</span>}
        </button>
    );
}

/** Compacte keuzeregel: tekst links, kleine foto rechts (lichtbron en snoer). */
function Row({ option, selected, disabled, onSelect, children }: {
    option: Pick<Option, 'name' | 'sku' | 'image'>;
    selected: boolean;
    disabled?: string | null;
    onSelect: () => void;
    children?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={!!disabled}
            title={disabled ?? undefined}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selected ? 'border-gray-950 ring-1 ring-gray-950' : 'border-gray-200 hover:border-gray-400'
            }`}
        >
            <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-950">{option.name}</span>
                {children}
                {option.sku && <span className="mt-0.5 block font-mono text-xs text-gray-400">{option.sku}</span>}
                {disabled && <span className="mt-0.5 block text-xs text-red-600">{disabled}</span>}
            </span>
            {option.image ? (
                <img src={option.image} alt="" className="size-16 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
            ) : (
                <span className="size-16 shrink-0" />
            )}
        </button>
    );
}

/**
 * Driver voor de LED-lampen (Milliamps). Per dimtype de drivers; het aantal stuks volgt uit het totale vermogen.
 * Dezelfde rekenregel als CompatibilityService::driverCount.
 */
function DriverStep() {
    const data = useConfigurator((s) => s.data);
    const selections = useConfigurator((s) => s.selections);
    const pricing = useConfigurator((s) => s.pricing);
    const selectDriver = useConfigurator((s) => s.selectDriver);

    const base = options(data, 'base').find((o) => o.key === selections.base);
    if (base?.meta.includes_driver) {
        return <p className="text-sm text-gray-600">De driver zit al in deze canopy. Je hoeft hier niets te kiezen.</p>;
    }

    const glasses = glassPerPosition({ data, selections }).filter(Boolean);
    const watts = glasses.reduce((sum, g) => sum + Number(g!.meta.max_watt || 1), 0);
    // Driver "per armatuur": één per lamp. Anders zoveel lampen per driver als het wattbereik toelaat.
    const count = (o: Option) => (o.meta.per_lamp ? glasses.length : Math.max(1, Math.ceil(watts / o.meta.max_w)));
    const fits = (o: Option) => o.meta.per_lamp || watts / count(o) >= o.meta.min_w;
    const chosen = pricing?.items.find((i) => i.role === 'driver')?.sku;
    const drivers = options(data, 'driver');
    const groups = [...new Set(drivers.map((o) => o.meta.dimming as string))];

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-600">
                {glasses.length} LED-lampen, samen {String(watts).replace('.', ',')} W. Wij adviseren de gemarkeerde driver; kies een andere als je anders wilt dimmen.
            </p>
            {groups.map((group) => (
                <div key={group}>
                    <p className="mb-2 text-sm font-medium text-gray-950">{group}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {drivers.filter((o) => o.meta.dimming === group).map((o) => (
                            <Row
                                key={o.key}
                                option={{ ...o, image: o.image }}
                                selected={chosen === o.sku}
                                disabled={fits(o) ? null : `Te weinig lampen voor deze driver (minimaal ${String(o.meta.min_w).replace('.', ',')} W)`}
                                onSelect={() => selectDriver(o.key)}
                            >
                                <span className="block text-xs text-gray-500">
                                    {fits(o) ? `${count(o)} x nodig · ` : ''}
                                    {o.meta.per_lamp ? 'één per lamp' : `meerdere lampen per driver (${String(o.meta.min_w).replace('.', ',')}–${String(o.meta.max_w).replace('.', ',')} W)`}
                                </span>
                                {o.price !== null && <span className="block text-xs text-gray-700">{formatPrice(o.price)} per stuk</span>}
                            </Row>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Pijlen-icoon per compositie, naar de tekeningen in de catalogus. */
function CompositionIcon({ name }: { name: string }) {
    const heights: Record<string, number[]> = {
        straight: [30, 30, 30, 30, 30],
        random: [22, 34, 18, 38, 26],
        'v-shape': [18, 28, 40, 28, 18],
        swirl: [16, 22, 28, 34, 40],
    };
    return (
        <svg viewBox="0 0 100 50" className="my-2 h-10 w-full" aria-hidden="true">
            <rect x="5" y="2" width="90" height="4" fill="#111" />
            {(heights[name] ?? heights.random).map((h, i) => (
                <g key={i}>
                    <line x1={15 + i * 17.5} y1="6" x2={15 + i * 17.5} y2={h} stroke="#111" strokeWidth="1" />
                    <circle cx={15 + i * 17.5} cy={h + 4} r="4" fill="none" stroke="#111" strokeWidth="1.5" />
                </g>
            ))}
        </svg>
    );
}

function PendantStep() {
    const data = useConfigurator((s) => s.data);
    const selections = useConfigurator((s) => s.selections);
    const pricing = useConfigurator((s) => s.pricing);
    const setLength = useConfigurator((s) => s.setLength);
    const selectCable = useConfigurator((s) => s.selectCable);
    const [custom, setCustom] = useState(selections.custom_length ?? 2);

    const glasses = glassPerPosition({ data, selections });
    const standalone = isStandalone({ data, selections });
    if (standalone) {
        const included = glasses[0]?.meta.cable_length ?? 3;
        return (
            <div className="space-y-4">
                <p className="text-sm text-gray-600">Standaard met {String(included).replace('.', ',')} meter snoer. Een langer snoer kan op aanvraag.</p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setLength(included)}
                        className={`rounded-full border px-4 py-2 text-sm ${selections.length !== 'custom' ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300 hover:border-gray-500'}`}
                    >
                        {String(included).replace('.', ',')} meter (standaard)
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const longer = Math.max(custom, included + 0.5);
                            setCustom(longer);
                            setLength('custom', longer);
                        }}
                        className={`rounded-full border px-4 py-2 text-sm ${selections.length === 'custom' ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300 hover:border-gray-500'}`}
                    >
                        Langer snoer
                    </button>
                </div>
                {selections.length === 'custom' && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        Gewenste lengte
                        <input
                            type="number"
                            min={included}
                            max={15}
                            step={0.5}
                            value={custom}
                            onChange={(e) => {
                                setCustom(Number(e.target.value));
                                setLength('custom', Number(e.target.value));
                            }}
                            className="w-24 rounded-md border border-gray-300 px-2 py-1"
                        />
                        meter <span className="text-gray-500">(op aanvraag, via offerte)</span>
                    </label>
                )}
            </div>
        );
    }
    // Lampen met een eigen pendel (Ozone, Hortense, Soffio): hun eigen snoerlengte is standaard, de rest op maat.
    const included = glasses.length > 0 && glasses.every((g) => g?.meta.pendant_included);
    const ownLength: number = glasses[0]?.meta.cable_length ?? 1.5;
    const standards = included ? [ownLength] : (data?.cable_lengths ?? []);

    const pendant = pricing?.items.find((i) => i.role === 'pendant');
    const min = data?.cable_min ?? 0.5;
    const max = data?.cable_max ?? 6;
    const meters = selections.length === 'custom' ? (selections.custom_length ?? custom) : included ? ownLength : Number(selections.length ?? 1.5);
    const setMeters = (value: number) => {
        const v = Math.min(max, Math.max(min, Math.round(value * 10) / 10));
        setCustom(v);
        // Standaardlengtes (1,5 en 3 meter, of het eigen snoer van de lamp) direct, alle andere lengtes op maat.
        setLength(standards.includes(v) ? v : 'custom', v);
    };
    const voltageCores = data?.settings.voltage === 'mA' ? 2 : 3;
    const cables = options(data, 'cable').filter((o) => o.meta.cores === voltageCores);
    const nl = (v: number) => String(v).replace('.', ',');

    return (
        <div className="space-y-6">
            <div>
                <p className="mb-2 text-sm font-medium text-gray-950">Snoerlengte</p>
                <div className="flex flex-wrap items-center gap-2">
                    {standards.map((length) => (
                        <button
                            key={length}
                            type="button"
                            onClick={() => setMeters(length)}
                            className={`rounded-full border px-4 py-2 text-sm ${selections.length !== 'custom' && meters === length ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300 hover:border-gray-500'}`}
                        >
                            {nl(length)} meter{included && ' (standaard)'}
                        </button>
                    ))}
                    <span className={`rounded-full border px-4 py-2 text-sm ${selections.length === 'custom' ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 text-gray-500'}`}>
                        Op maat: {nl(meters)} m
                    </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs whitespace-nowrap text-gray-500">{nl(min)} m</span>
                    <input type="range" min={min} max={max} step={0.1} value={meters} onChange={(e) => setMeters(Number(e.target.value))} className="w-full accent-gray-950" />
                    <span className="text-xs whitespace-nowrap text-gray-500">{nl(max)} m</span>
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={0.1}
                        value={meters}
                        onChange={(e) => setMeters(Number(e.target.value))}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        aria-label="Snoerlengte in meters"
                    />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                    Afstand van het plafond tot de onderkant van het laagste glas.{' '}
                    {included ? `Deze lamp heeft standaard ${nl(ownLength)} meter snoer` : '1,5 en 3 meter zijn standaard'}, andere lengtes via een offerte.
                </p>
            </div>

            <div>
                <p className="mb-2 text-sm font-medium text-gray-950">Snoer</p>
                <div className="grid gap-2 sm:grid-cols-2">
                    <Row option={{ name: 'Standaard snoer', sku: pendant?.sku ?? null, image: null }} selected={!selections.cable} onSelect={() => selectCable(null)}>
                        <span className="block text-xs text-gray-500">{pendant?.description ?? (included ? 'Zit bij de lamp' : 'Zit bij de pendel')}</span>
                    </Row>
                    {cables.map((o) => (
                        <Row key={o.key} option={o} selected={selections.cable === o.key} onSelect={() => selectCable(o.key)}>
                            {o.price !== null && <span className="block text-xs text-gray-700">{formatPrice(o.price)} per meter · op maat via offerte</span>}
                        </Row>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Het advies bij het glas staat bovenaan en is gekozen; andere lampen en "zonder lichtbron" onder "Meer opties". */
function BulbStep() {
    const data = useConfigurator((s) => s.data);
    const selections = useConfigurator((s) => s.selections);
    const selectBulb = useConfigurator((s) => s.selectBulb);
    const [more, setMore] = useState(false);

    const glasses = glassPerPosition({ data, selections }).filter((g) => g?.meta.bulb_sku);
    if (!glasses.length) {
        return <p className="text-sm text-gray-600">De lichtbron zit bij dit armatuur inbegrepen of is ingebouwd. Je hoeft hier niets te kiezen.</p>;
    }

    const fittings = new Set(glasses.map((g) => g!.meta.fitting));
    const advised = new Set(glasses.map((g) => g!.meta.bulb_sku));
    const list = options(data, 'bulb').filter((o) => o.key !== 'none' && fittings.has(o.meta.fitting));
    const none = options(data, 'bulb').find((o) => o.key === 'none');
    const recommended = list.filter((o) => advised.has(o.sku));
    const others = list.filter((o) => !advised.has(o.sku));
    const selected = selections.bulb ?? recommended[0]?.key;
    const row = (o: Option) => (
        <Row key={o.key} option={o} selected={selected === o.key} onSelect={() => selectBulb(advised.has(o.sku) ? null : o.key)}>
            {advised.has(o.sku) && <span className="block text-xs font-medium text-emerald-700">Advies bij dit glas</span>}
            {o.price !== null && <span className="block text-xs text-gray-700">{formatPrice(o.price)} per stuk</span>}
        </Row>
    );

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600">Fitting: {[...fittings].join(', ')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
                {recommended.map(row)}
                {none && (
                    <Row option={{ ...none, image: null }} selected={selected === 'none'} onSelect={() => selectBulb('none')}>
                        <span className="block text-xs text-gray-500">Je plaatst zelf een lamp.</span>
                    </Row>
                )}
            </div>

            {others.length > 0 && (
                <div>
                    <button type="button" onClick={() => setMore(!more)} className="text-sm text-gray-700 underline hover:text-gray-950">
                        {more ? 'Minder opties' : `Meer lichtbronnen (${others.length})`}
                    </button>
                    {(more || others.some((o) => o.key === selected)) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{others.map(row)}</div>}
                </div>
            )}
        </div>
    );
}

export default function ComponentSelector({ step }: { step: Exclude<StepKey, 'glass'> }) {
    const data = useConfigurator((s) => s.data);
    const selections = useConfigurator((s) => s.selections);
    const availability = useConfigurator((s) => s.pricing?.availability);
    const selectBase = useConfigurator((s) => s.selectBase);
    const selectComposition = useConfigurator((s) => s.selectComposition);
    const selectAssembly = useConfigurator((s) => s.selectAssembly);

    if (step === 'pendant') return <PendantStep />;
    if (step === 'bulb') return <BulbStep />;

    if (isStandalone({ data, selections })) {
        return <p className="text-sm text-gray-600">Dit is een complete hanglamp met eigen plafondkap. Je hoeft in deze stap niets te kiezen.</p>;
    }

    const list = options(data, step);

    if (step === 'base') {
        const groups = [...new Set(list.map((o) => o.group as string))];
        return (
            <div className="space-y-6">
                {groups.map((group) => (
                    <div key={group}>
                        <p className="mb-2 text-sm font-medium text-gray-950">{BASE_GROUPS[group] ?? group}</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {list.filter((o) => o.group === group).map((o) => {
                                const selected = selections.base === o.key;
                                const color = selected ? selections.base_color : 'zwart';
                                const price = o.finish_prices?.[color] ?? null;
                                return (
                                    <div key={o.key} className="relative">
                                        <Card option={{ ...o, sku: o.meta.finishes?.[color] ?? o.sku }} selected={selected} onSelect={() => selectBase(o.key)}>
                                            <span className="block text-xs text-gray-500">{o.meta.lights} lichtpunten</span>
                                            <span className="mt-1 block text-sm text-gray-700">{price !== null ? formatPrice(price) : `${BASE_COLORS[color].name}: op aanvraag`}</span>
                                            {o.meta.requires_assembly && <span className="mt-1 block text-xs text-amber-700">Montage door Maretti</span>}
                                        </Card>
                                        {/* Kleur van de plafondbasis, op de tekening; buiten de kaart-knop omdat knoppen niet in knoppen mogen. */}
                                        <div className="absolute top-5 left-5 flex gap-1.5">
                                            {(Object.keys(BASE_COLORS) as BaseColor[]).map((c) => {
                                                // Kleuren zonder artikel in AccountView zijn op aanvraag: licht en gestippeld, zodat je ziet dat ze niet direct leverbaar zijn.
                                                const onRequest = o.finish_prices?.[c] == null;
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        title={`${BASE_COLORS[c].name}${onRequest ? ' (op aanvraag)' : ''}`}
                                                        aria-label={`${BASE_COLORS[c].name}${onRequest ? ' op aanvraag' : ''}`}
                                                        onClick={() => selectBase(o.key, c)}
                                                        className={`size-5 rounded-full ${onRequest ? 'border border-dashed border-gray-500 opacity-40 hover:opacity-80' : 'border border-black/15'} ${selected && color === c ? 'opacity-100 ring-2 ring-gray-950 ring-offset-1' : ''}`}
                                                        style={{ background: BASE_COLORS[c].swatch }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <p className="text-xs text-gray-500">Kleur van de plafondbasis: volle rondjes zijn direct leverbaar, lichte gestippelde rondjes maakt Maretti op aanvraag.</p>
                {data?.settings.glass_mode === 'sizes' ? <SizeEditor /> : <MixEditor />}
            </div>
        );
    }

    if (step === 'driver') return <DriverStep />;

    if (step === 'composition') {
        if ((options(data, 'base').find((o) => o.key === selections.base)?.meta.lights ?? 1) <= 1) {
            return <p className="text-sm text-gray-600">Bij één lamp aan een canopy kies je geen compositie. Kies bij de plafondbasis meer lichtpunten om een compositie te maken.</p>;
        }
        return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {list.map((o) => (
                    <Card key={o.key} option={o} selected={selections.composition === o.key} disabled={availability?.composition?.[o.key]} onSelect={() => selectComposition(o.key)}>
                        <CompositionIcon name={o.key} />
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-3">
            {list.map((o) => (
                <Card
                    key={o.key}
                    option={o}
                    selected={selections.assembly === o.key}
                    disabled={availability?.assembly?.[o.key]}
                    onSelect={() => selectAssembly(o.key as 'self' | 'maretti')}
                >
                    <span className="block text-xs text-gray-500">
                        {o.key === 'self' ? 'Je ontvangt alle onderdelen los, met handleiding.' : 'Wij leveren de armatuur kant-en-klaar gemonteerd.'}
                    </span>
                </Card>
            ))}
        </div>
    );
}
