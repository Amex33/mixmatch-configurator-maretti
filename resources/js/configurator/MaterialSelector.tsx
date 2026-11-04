import { useState } from 'react';
import { bySize, glassPerPosition, isStandalone, option, options, useConfigurator } from './stores/configuratorStore';
import { formatPrice } from './PriceSummary';
import type { Option } from './types';

export const SWATCHES: Record<string, string> = {
    koper: '#b87333',
    smoke: '#4a4a50',
    cognac: '#b8742a',
    helder: 'linear-gradient(135deg, #ffffff, #dfe6ea)',
    mat: '#ece8df',
    brons: '#8c6a3f',
    chroom: 'linear-gradient(135deg, #f5f7f8, #a9b1b6)',
    'zwart-goud': 'linear-gradient(135deg, #111 50%, #c9a24a 50%)',
    amber: '#c8861e',
    goud: '#c9a24a',
    albast: '#f1ebe0',
    zwart: '#111111',
    'zwart met perfo': 'radial-gradient(circle, #555 25%, #111 26%) 0 0 / 5px 5px',
    rosegoud: '#c9967f',
    kristal: 'linear-gradient(135deg, #ffffff, #cfd6da 50%, #ffffff)',
    gunmetal: '#3d3f42',
    wit: '#ffffff',
    rood: '#a3242b',
    bruin: '#5e3a22',
    blauw: '#2c4f7c',
    'smoke-zwart': 'linear-gradient(135deg, #4a4a50 50%, #111 50%)',
    'smoke-messing': 'linear-gradient(135deg, #4a4a50 50%, #b5954f 50%)',
    'opaal-zwart': 'linear-gradient(135deg, #f4f1ea 50%, #111 50%)',
    'opaal-messing': 'linear-gradient(135deg, #f4f1ea 50%, #b5954f 50%)',
};

/** Rondje in de kleur van de uitvoering; zonder vaste kleur de kleur van de productfoto. */
export function Swatch({ variant, className = 'size-5' }: { variant: Option; className?: string }) {
    return <span className={`${className} inline-block shrink-0 rounded-full border border-black/10`} style={{ background: SWATCHES[variant.meta.color] ?? variant.meta.tint ?? '#ddd' }} />;
}

/** Naam van de uitvoering zoals de klant hem ziet: "smoke glas, messing", "5-lichts", "koper". */
export const variantName = (variant: Option) => (variant.meta.color_label ?? variant.meta.color) as string;

/** Stap 1: alleen de gekozen lamp, met de maten en de kleuren (of het aantal lichten) die echt bestaan. */
export default function MaterialSelector() {
    const data = useConfigurator((s) => s.data);
    const family = useConfigurator((s) => s.family);
    const color = useConfigurator((s) => s.color);
    const size = useConfigurator((s) => s.size);
    const selectFamily = useConfigurator((s) => s.selectFamily);
    const showOverview = useConfigurator((s) => s.showOverview);

    const sizesMode = data?.settings.glass_mode === 'sizes';
    const variants = options(data, 'glass').filter((o) => o.group === family);
    const first = variants[0];
    if (!family || !first) return null;

    // Bij Large kies je de maat per positie bij de plafondbasis, dus hier alleen de kleur.
    const sizes = sizesMode ? [] : ([...new Set(variants.map((o) => o.meta.size).filter(Boolean))] as string[]).sort(bySize);
    const visible = sizes.length > 1 ? variants.filter((o) => o.meta.size === size) : variants;
    const colors = [...new Map(visible.map((o) => [o.meta.color as string, o])).values()];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-gray-600">
                    {first.meta.fitting} · max {first.meta.max_watt}W
                </p>
                <button type="button" onClick={() => showOverview()} className="text-sm text-gray-600 underline hover:text-gray-950">
                    Andere lamp kiezen
                </button>
            </div>

            {sizes.length > 1 && (
                <div>
                    <p className="mb-2 text-sm font-medium text-gray-950">{first.meta.size_label ?? 'Maat'}</p>
                    <div className="flex flex-wrap gap-2">
                        {sizes.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => selectFamily(family, undefined, s)}
                                className={`rounded-full border px-4 py-2 text-sm ${size === s ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-300 hover:border-gray-500'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <p className="mb-2 text-sm font-medium text-gray-950">{first.meta.option_label ?? 'Kleur'}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {colors.map((variant) => (
                        <button
                            key={variant.key}
                            type="button"
                            onClick={() => selectFamily(family, variant.meta.color, variant.meta.size)}
                            className={`rounded-xl border p-3 text-left transition ${color === variant.meta.color ? 'border-gray-950 ring-1 ring-gray-950' : 'border-gray-200 hover:border-gray-400'}`}
                        >
                            {variant.image && <img src={variant.image} alt="" className="mb-2 aspect-square w-full rounded-lg bg-white object-contain" loading="lazy" />}
                            <span className="flex items-center gap-2 font-medium text-gray-950">
                                {!first.meta.option_label && <Swatch variant={variant} />}
                                {variantName(variant)}
                            </span>
                            {variant.price !== null && <span className="mt-1 block text-sm text-gray-700">{formatPrice(variant.price)}</span>}
                            {variant.sku && <span className="mt-1 block font-mono text-xs text-gray-400">{variant.sku}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {sizesMode ? (
                <p className="text-sm text-gray-500">Bij de plafondbasis kies je per positie de maat (S, M of L). We stellen alvast een indeling voor.</p>
            ) : (
                <MixEditor />
            )}
        </div>
    );
}

/**
 * Glazen uit verschillende series combineren in één armatuur (bijvoorbeeld Tulip met Icosa): per positie een glas.
 * Complete hanglampen met eigen plafondkap (Hortense) doen niet mee.
 */
export function MixEditor() {
    const data = useConfigurator((s) => s.data);
    const selections = useConfigurator((s) => s.selections);
    const mixed = useConfigurator((s) => s.mixed);
    const startMix = useConfigurator((s) => s.startMix);
    const setMixed = useConfigurator((s) => s.setMixed);
    const stopMix = useConfigurator((s) => s.stopMix);
    const goTo = useConfigurator((s) => s.goTo);

    if (data?.settings.glass_mode === 'sizes' || isStandalone({ data, selections })) return null;

    const lights = option(data, 'base', selections.base)?.meta.lights ?? 1;
    // LED-lampen (met driver) en lampen met een fitting (E27, G9, ...) niet samen in één armatuur: alleen glazen van hetzelfde type.
    const lightType = (o?: Option) => (o?.meta.fitting === 'LED' ? 'led' : 'bulb');
    const current = lightType(glassPerPosition({ data, selections })[0]);
    const glasses = options(data, 'glass').filter((o) => !o.meta.standalone && lightType(o) === current);
    const families = [...new Set(glasses.map((o) => o.group as string))];
    const positions = glassPerPosition({ data, selections });

    if (lights <= 1) {
        return (
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                Wil je verschillende glazen combineren, bijvoorbeeld Tulip met Icosa? Kies eerst een{' '}
                <button type="button" onClick={() => goTo('base')} className="underline hover:text-gray-950">
                    plafondbasis met meer lichtpunten
                </button>
                .
            </div>
        );
    }

    if (!mixed) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-600">
                    Alle {lights} posities krijgen hetzelfde glas. Je kunt ook maten mixen (Tulip Ø20, Ø30 en Ø40 in één armatuur) of glazen uit andere series in dezelfde kleur combineren.
                </p>
                <button type="button" onClick={startMix} className="rounded-full border border-gray-950 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gray-950 hover:text-white">
                    Glazen combineren
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 rounded-xl bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-950">Glazen combineren</p>
                <button type="button" onClick={stopMix} className="text-sm text-gray-600 underline hover:text-gray-950">
                    Overal hetzelfde glas
                </button>
            </div>

            {/* Andere basis of ander glas gekozen: verdeling opnieuw opbouwen. */}
            <Distribution key={`${lights}-${selections.base}`} lights={lights} glasses={glasses} />

            <details className="rounded-lg bg-white p-3">
                <summary className="cursor-pointer text-sm text-gray-700">Glas per positie aanpassen</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {positions.map((glass, i) => (
                        <label key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                            <span className="w-5 text-right text-sm text-gray-500">{i + 1}.</span>
                            {glass?.image ? <img src={glass.image} alt="" className="size-10 shrink-0 rounded bg-white object-contain" /> : <span className="size-10 shrink-0" />}
                            <GlassSelect glasses={glasses} families={families} value={glass?.key ?? ''} onChange={(key) => setMixed(i, key)} />
                        </label>
                    ))}
                </div>
            </details>
            <p className="text-xs text-gray-500">
                Elk glas krijgt de pendel en lichtbron die erbij horen. Meer posities kies je bij de plafondbasis.{' '}
                {current === 'led' ? 'Je ziet alleen LED-lampen: die combineer je niet met lampen met een fitting.' : 'Je ziet alleen lampen met een fitting: LED-lampen met een driver combineer je niet in dezelfde armatuur.'}
            </p>
        </div>
    );
}

function GlassSelect({ glasses, families, value, onChange }: { glasses: Option[]; families: string[]; value: string; onChange: (key: string) => void }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-950">
            {families.map((family) => (
                <optgroup key={family} label={family}>
                    {glasses.filter((o) => o.group === family).map((o) => (
                        <option key={o.key} value={o.key}>
                            {o.name}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

/**
 * Verdeling: welk glas hoe vaak, bijvoorbeeld 5 x Tulip Ø40, 5 x Ø30 en 5 x Ø20 op een 15-lichts basis.
 * Standaard alle maten van het gekozen glas in de gekozen kleur; "zelfde kleur" toont ook glazen uit andere series in die kleur.
 */
function Distribution({ lights, glasses }: { lights: number; glasses: Option[] }) {
    const family = useConfigurator((s) => s.family);
    const color = useConfigurator((s) => s.color);
    const mixed = useConfigurator((s) => s.mixed);
    const distribute = useConfigurator((s) => s.distribute);
    const [sameColor, setSameColor] = useState(true);

    const counted = (keys: string[]) => [...new Set(keys)].map((key) => ({ key, count: keys.filter((k) => k === key).length }));
    const initial = () => {
        const current = (mixed ?? []).slice(0, lights);
        if (new Set(current).size > 1) return counted(current);
        // Nog alles gelijk: verdeel over de maten van dit glas in deze kleur, de rest naar de grootste maat.
        const sizes = glasses.filter((o) => o.group === family && o.meta.color === color).sort((a, b) => bySize(b.meta.size ?? '0', a.meta.size ?? '0'));
        if (sizes.length < 2) return [{ key: current[0] ?? glasses[0]?.key, count: lights }];
        return sizes.map((o, i) => ({ key: o.key, count: Math.floor(lights / sizes.length) + (i < lights % sizes.length ? 1 : 0) }));
    };
    const [rows, setRows] = useState(initial);

    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const choices = sameColor ? glasses.filter((o) => o.meta.color === color || rows.some((r) => r.key === o.key)) : glasses;
    const choiceFamilies = [...new Set(choices.map((o) => o.group as string))];
    const change = (i: number, patch: Partial<{ key: string; count: number }>) => setRows(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));

    return (
        <div className="rounded-lg bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-950">Verdeling</p>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" checked={sameColor} onChange={(e) => setSameColor(e.target.checked)} />
                    Alleen glazen in {color}
                </label>
            </div>
            <div className="space-y-2">
                {rows.map((row, i) => {
                    const glass = glasses.find((o) => o.key === row.key);
                    return (
                        <div key={i} className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={lights}
                                value={row.count}
                                onChange={(e) => change(i, { count: Math.max(0, Number(e.target.value)) })}
                                className="w-14 rounded-md border border-gray-300 px-2 py-1 text-sm"
                                aria-label="Aantal"
                            />
                            <span className="text-sm text-gray-500">x</span>
                            {glass?.image ? <img src={glass.image} alt="" className="size-9 shrink-0 rounded object-contain" /> : <span className="size-9 shrink-0" />}
                            <GlassSelect glasses={choices} families={choiceFamilies} value={row.key} onChange={(key) => change(i, { key })} />
                            {rows.length > 1 && (
                                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="px-1 text-gray-400 hover:text-gray-950" aria-label="Verwijderen">
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setRows([...rows, { key: choices[0]?.key ?? glasses[0].key, count: Math.max(0, lights - total) }])} className="text-sm text-gray-700 underline hover:text-gray-950">
                    + Glas toevoegen
                </button>
                <div className="flex items-center gap-3">
                    <span className={`text-sm ${total === lights ? 'text-gray-600' : 'text-red-600'}`}>
                        {total} van {lights} posities
                    </span>
                    <button
                        type="button"
                        disabled={total !== lights}
                        onClick={() => distribute(rows)}
                        className="rounded-full bg-gray-950 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-30"
                    >
                        Toepassen
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Alleen bij 230V Large: maat per positie, uitgaande van het advies uit de catalogus. */
export function SizeEditor() {
    const data = useConfigurator((s) => s.data);
    const family = useConfigurator((s) => s.family);
    const sizes = useConfigurator((s) => s.sizes);
    const setSize = useConfigurator((s) => s.setSize);
    const selections = useConfigurator((s) => s.selections);

    const available = [...new Set(options(data, 'glass').filter((o) => o.group === family).map((o) => o.meta.size as string))];
    const glassKeys = Array.isArray(selections.glass) ? selections.glass : [];

    return (
        <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-950">Maat per positie</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {sizes.map((size, i) => {
                    // Foto van het glas dat nu op deze positie hangt, zodat je de maten naast elkaar ziet.
                    const glass = option(data, 'glass', glassKeys[i]);
                    return (
                        <label key={i} className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm text-gray-600">
                            <span className="w-5 text-right">{i + 1}.</span>
                            {glass?.image ? (
                                <img src={glass.image} alt={glass.name} title={glass.name} className="size-10 shrink-0 rounded object-contain" loading="lazy" />
                            ) : (
                                <span className="size-10 shrink-0 rounded bg-gray-100" />
                            )}
                            <select
                                value={size}
                                onChange={(e) => setSize(i, e.target.value)}
                                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-950"
                                title={glass?.name}
                            >
                                {available.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
