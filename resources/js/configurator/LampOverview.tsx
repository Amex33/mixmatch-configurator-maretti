import { useState } from 'react';
import { Swatch, variantName } from './MaterialSelector';
import { formatPrice } from './PriceSummary';
import { lamps, useConfigurator, type Lamp } from './stores/configuratorStore';
import type { Option } from './types';

/**
 * Eén lamp op de overzichtspagina. De keuzes (kleur, aantal lichten bij Hortense, vorm bij Zen, maat bij Venetian)
 * staan op de foto: met de muis erover zie je die uitvoering, met een klik open je hem.
 */
function LampTile({ lamp }: { lamp: Lamp }) {
    const openLamp = useConfigurator((s) => s.openLamp);
    const catalog = useConfigurator((s) => s.catalog);
    const [preview, setPreview] = useState<Option | null>(null);

    const variants = (catalog[lamp.line.slug]?.components.find((c) => c.key === 'glass')?.options ?? []).filter((o) => o.group === lamp.family);
    const label = lamp.colors[0]?.meta.option_label;
    const sizeLabel = lamp.colors[0]?.meta.size_label ?? 'Maat';
    const image = preview?.image ?? lamp.image;
    const open = (variant?: Option) => openLamp(lamp.line.slug, lamp.family, true, variant?.meta.color, variant?.meta.size);
    const hover = (variant: Option) => ({ onMouseEnter: () => setPreview(variant), onFocus: () => setPreview(variant) });

    return (
        <div className="group rounded-2xl border border-gray-200 p-3 transition hover:border-gray-950" onMouseLeave={() => setPreview(null)}>
            <button type="button" onClick={() => open(preview ?? undefined)} className="block aspect-[3/4] w-full overflow-hidden rounded-xl bg-white" aria-label={lamp.family}>
                {image ? (
                    <img src={image} alt="" className="h-full w-full object-contain transition group-hover:scale-105" loading="lazy" />
                ) : (
                    <span className="flex h-full items-center justify-center text-xs text-gray-400">Geen foto</span>
                )}
            </button>

            {/* Naam met de maten ernaast (alleen cm); met de muis over een maat zie je die maat. */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <button type="button" onClick={() => open(preview ?? undefined)} className="font-medium text-gray-950">
                    {lamp.family}
                </button>
                {lamp.sizes.length > 1 &&
                    lamp.sizes.map((size) => {
                        const variant = variants.find((o) => o.meta.size === size)!;
                        return (
                            <button
                                key={size}
                                type="button"
                                aria-label={`${sizeLabel} ${size}`}
                                {...hover(variant)}
                                onClick={() => open(variant)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] text-gray-700 hover:border-gray-950 ${preview?.meta.size === size ? 'border-gray-950' : 'border-gray-300'}`}
                            >
                                {size}
                            </button>
                        );
                    })}
            </div>

            {/* Kleuren (of aantal lichten bij Hortense) op één regel onder de naam. */}
            <div className="mt-2 flex flex-nowrap items-center gap-1 overflow-x-auto">
                {lamp.colors.map((variant) =>
                    label ? (
                        <button
                            key={variant.key}
                            type="button"
                            {...hover(variant)}
                            onClick={() => open(variant)}
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-gray-700 hover:border-gray-950 ${preview?.key === variant.key ? 'border-gray-950' : 'border-gray-300'}`}
                        >
                            {variantName(variant)}
                        </button>
                    ) : (
                        <button
                            key={variant.key}
                            type="button"
                            title={variantName(variant)}
                            aria-label={variantName(variant)}
                            {...hover(variant)}
                            onClick={() => open(variant)}
                            className={`shrink-0 rounded-full p-0.5 ring-gray-950 hover:ring-1 ${preview?.meta.color === variant.meta.color ? 'ring-1' : ''}`}
                        >
                            <Swatch variant={variant} className="size-4" />
                        </button>
                    ),
                )}
            </div>

            <button type="button" onClick={() => open(preview ?? undefined)} className="mt-1 block w-full text-left">
                <span className="block text-xs text-gray-500">{preview ? variantName(preview) + (preview.meta.size ? ` · ${preview.meta.size}` : '') : lamp.line.name}</span>
                {(preview?.price ?? lamp.from) !== null && (
                    <span className="mt-1 block text-sm text-gray-700">{preview?.price != null ? formatPrice(preview.price) : `vanaf ${formatPrice(lamp.from!)}`}</span>
                )}
            </button>
        </div>
    );
}

/** Startpagina: alle lampen van alle lijnen. */
export default function LampOverview() {
    const lines = useConfigurator((s) => s.lines);
    const catalog = useConfigurator((s) => s.catalog);
    const [line, setLine] = useState<string | null>(null);

    const all = lamps(lines, catalog);
    const shown = line ? all.filter((lamp) => lamp.line.slug === line) : all;

    return (
        <div>
            <div className="flex flex-wrap gap-2">
                {[null, ...lines.map((l) => l.slug)].map((slug) => (
                    <button
                        key={slug ?? 'all'}
                        type="button"
                        onClick={() => setLine(slug)}
                        className={`rounded-full px-4 py-2 text-sm font-medium ${line === slug ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-950 hover:bg-gray-200'}`}
                    >
                        {slug ? lines.find((l) => l.slug === slug)?.name : 'Alle lampen'}
                    </button>
                ))}
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {shown.map((lamp) => (
                    <LampTile key={`${lamp.line.slug}-${lamp.family}`} lamp={lamp} />
                ))}
            </div>
        </div>
    );
}
