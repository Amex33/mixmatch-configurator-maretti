import { create } from 'zustand';
import type { BaseColor, ConfiguratorData, ConfiguratorLine, Customer, Length, Option, Pricing, Selections, StepKey } from '../types';

export const STEPS: StepKey[] = ['glass', 'bulb', 'pendant', 'base', 'driver', 'composition', 'assembly'];

let apiBase = '';
export const setApiBase = (base: string) => (apiBase = base.replace(/\/$/, ''));
/** Sfeer in het 3D-voorbeeld: alleen de lamp, of met eettafel, salontafel of trap in een vide. Hoort niet bij de bestelling. */
export type Scene = 'none' | 'dining' | 'coffee' | 'stairs';

/** Het canvas van het 3D-voorbeeld, voor het downloaden als PNG of PDF. */
let viewerCanvas: HTMLCanvasElement | null = null;
export const setViewerCanvas = (canvas: HTMLCanvasElement | null) => (viewerCanvas = canvas);
export const getViewerCanvas = () => viewerCanvas;

/** Bestanden van de Laravel-app (zoals de 3D-modellen), ook als de configurator in Magento draait. */
export const assetUrl = (path: string) => `${apiBase}${path}`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBase}/api${path}`, {
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.errors?.[0] ?? body.message ?? 'Er ging iets mis, probeer het opnieuw.');
    return body as T;
}

/** Eén tegel op de overzichtspagina: een lampfamilie binnen een lijn. */
export interface Lamp {
    line: ConfiguratorLine;
    family: string;
    image: string | null;
    from: number | null;
    /** Eén uitvoering per kleur (of per aantal lichten), voor de keuzes onder de foto. */
    colors: Option[];
    sizes: string[];
}

interface State {
    lines: ConfiguratorLine[];
    /** Alle lijnen, eenmalig opgehaald voor de overzichtspagina. */
    catalog: Record<string, ConfiguratorData>;
    view: 'overview' | 'configure';
    data: ConfiguratorData | null;
    step: StepKey;
    selections: Selections;
    /** Het glas volgt uit familie + kleur, en bij één glas per armatuur ook de maat (Venetian, Paradiso, Zen). */
    family: string | null;
    color: string | null;
    size: string | null;
    /** Alleen bij 230V Large: per positie een maat. */
    sizes: string[];
    /** Combinatie van verschillende glazen (Tulip met Icosa): per positie een glas. Null = overal hetzelfde glas. */
    mixed: string[] | null;
    scene: Scene;
    /** Silhouet van een vrouw (1,68 m) naast de lamp, om de maat te zien. */
    person: boolean;
    pricing: Pricing | null;
    busy: boolean;
    error: string | null;
    result: { type: 'quote'; uuid: string } | null;

    loadLines: () => Promise<void>;
    selectLine: (slug: string) => Promise<void>;
    openLamp: (slug: string, family: string, push?: boolean, color?: string, size?: string) => Promise<void>;
    showOverview: (push?: boolean) => void;
    goTo: (step: StepKey) => void;
    selectFamily: (family: string, color?: string, size?: string) => void;
    setSize: (position: number, size: string) => void;
    selectBulb: (key: string | null) => void;
    selectCable: (key: string | null) => void;
    selectDriver: (key: string | null) => void;
    setLength: (length: Length, custom?: number | null) => void;
    selectBase: (key: string, color?: BaseColor) => void;
    startMix: () => void;
    setMixed: (position: number, key: string) => void;
    distribute: (rows: { key: string; count: number }[]) => void;
    stopMix: () => void;
    setScene: (scene: Scene) => void;
    togglePerson: () => void;
    selectComposition: (key: string) => void;
    selectAssembly: (key: 'self' | 'maretti') => void;
    addToCart: () => Promise<void>;
    requestQuote: (customer: Customer) => Promise<void>;
}

export const option = (data: ConfiguratorData | null, step: StepKey, key: string | null | undefined): Option | undefined =>
    data?.components.find((c) => c.key === step)?.options.find((o) => o.key === key);

export const options = (data: ConfiguratorData | null, step: StepKey): Option[] =>
    data?.components.find((c) => c.key === step)?.options ?? [];

/** Een complete hanglamp (Hortense) hangt aan zijn eigen plafondkap: geen plafondbasis of compositie. */
export function isStandalone(state: Pick<State, 'data' | 'selections'>): boolean {
    const glass = state.selections.glass;
    return !!option(state.data, 'glass', Array.isArray(glass) ? glass[0] : glass)?.meta.standalone;
}

/** De glas-sleutel per positie, ook als er één glas voor alle posities is gekozen. */
export function glassPerPosition(state: Pick<State, 'data' | 'selections'>): (Option | undefined)[] {
    const lights = isStandalone(state) ? 1 : (option(state.data, 'base', state.selections.base)?.meta.lights ?? 1);
    const glass = state.selections.glass;
    const keys = Array.isArray(glass) ? glass : Array.from({ length: lights }, () => glass);
    return keys.slice(0, lights).map((key) => option(state.data, 'glass', key));
}

/** Maten van klein naar groot: 'Ø10 cm' < 'Ø15 cm'. Uitvoeringen zonder getal (Standaard, DALI) houden hun volgorde. */
export const bySize = (a: string, b: string) => {
    const n = (s: string) => parseFloat(s.replace(/[^\d.]/g, ' ').trim());
    return Number.isNaN(n(a)) || Number.isNaN(n(b)) ? 0 : n(a) - n(b);
};

/** Bestaat deze combinatie niet (Venetian Ø10 cm in brons), dan blijft de laatst aangeklikte keuze staan en past de andere zich aan. */
function variantFor(data: ConfiguratorData, family: string, color?: string | null, size?: string | null, prefer: 'color' | 'size' = 'color'): Option | undefined {
    const variants = options(data, 'glass').filter((o) => o.group === family);
    return (
        variants.find((o) => (!color || o.meta.color === color) && (!size || o.meta.size === size)) ??
        variants.find((o) => (prefer === 'color' ? !color || o.meta.color === color : !size || o.meta.size === size)) ??
        variants[0]
    );
}

/** Kies bij Large het glas van de juiste maat; valt terug op de dichtstbijzijnde maat. */
function glassForSize(data: ConfiguratorData, family: string, color: string, size: string): string | undefined {
    const candidates = options(data, 'glass').filter((o) => o.group === family && o.meta.color === color);
    const order = ['XS', 'S', 'M', 'L'];
    return (
        candidates.find((o) => o.meta.size === size) ??
        [...candidates].sort((a, b) => Math.abs(order.indexOf(a.meta.size) - order.indexOf(size)) - Math.abs(order.indexOf(b.meta.size) - order.indexOf(size)))[0]
    )?.key;
}

/** Alle lampfamilies van alle lijnen, in de volgorde van de seeder. */
export function lamps(lines: ConfiguratorLine[], catalog: Record<string, ConfiguratorData>): Lamp[] {
    return lines.flatMap((line) => {
        const glass = options(catalog[line.slug] ?? null, 'glass');
        return [...new Set(glass.map((o) => o.group as string))].map((family) => {
            const variants = glass.filter((o) => o.group === family);
            const prices = variants.map((o) => o.price).filter((p): p is number => p !== null);
            return {
                line,
                family,
                image: variants.find((o) => o.image)?.image ?? null,
                from: prices.length ? Math.min(...prices) : null,
                colors: [...new Map(variants.map((o) => [o.meta.color as string, o])).values()],
                sizes: line.settings.glass_mode === 'sizes' ? [] : ([...new Set(variants.map((o) => o.meta.size).filter(Boolean))] as string[]).sort(bySize),
            };
        });
    });
}

let pricingTimer: ReturnType<typeof setTimeout> | undefined;
let pricingRequest = 0;

export const useConfigurator = create<State>((set, get) => {
    /** Past afhankelijke keuzes aan en vraagt een nieuwe prijs op. */
    const update = (patch: Partial<State>) => {
        set(patch);
        const { data, selections, family, color, size, sizes, mixed } = get();
        if (!data) return;

        const base = option(data, 'base', selections.base);
        const next = { ...selections };

        // Combinatie: per positie een eigen glas; bij meer posities herhaalt het laatste glas.
        if (mixed) {
            const lights = base?.meta.lights ?? 1;
            next.glass = Array.from({ length: lights }, (_, i) => mixed[i] ?? mixed[mixed.length - 1]);
        } else if (family && color) {
            // Het glas volgt uit familie + kleur + maat (bij Large de maat per positie).
            next.glass =
                data.settings.glass_mode === 'sizes'
                    ? (sizes.map((s) => glassForSize(data, family, color, s)).filter(Boolean) as string[])
                    : (variantFor(data, family, color, size)?.key ?? next.glass);
        }

        // Een lamp die niet in de fitting van het nieuwe glas past, terugzetten naar het advies.
        const bulb = option(data, 'bulb', next.bulb);
        const fittings = glassPerPosition({ data, selections: next }).filter((g) => g?.meta.bulb_sku).map((g) => g!.meta.fitting);
        if (bulb && bulb.key !== 'none' && !fittings.includes(bulb.meta.fitting)) next.bulb = null;

        // Compositie die niet bij de basis past, vervangen door de eerste die wel past.
        const composition = option(data, 'composition', next.composition);
        const fits = (o: Option) =>
            !base || ((o.meta.shapes ?? []).includes(base.meta.shape) && (!base.meta.compositions || base.meta.compositions.includes(o.key)));
        if (!composition || !fits(composition)) next.composition = options(data, 'composition').find(fits)?.key ?? null;

        if (base?.meta.requires_assembly) next.assembly = 'maretti';

        set({ selections: next });

        clearTimeout(pricingTimer);
        pricingTimer = setTimeout(async () => {
            const request = ++pricingRequest;
            try {
                const pricing = await api<Pricing>(`/configurators/${data.slug}/pricing`, { method: 'POST', body: JSON.stringify(get().selections) });
                if (request === pricingRequest) set({ pricing, error: null });
            } catch (e) {
                if (request === pricingRequest) set({ error: (e as Error).message });
            }
        }, 200);
    };

    const save = async () => {
        const { data, selections } = get();
        return api<{ uuid: string; quote_only: boolean }>('/configurations', {
            method: 'POST',
            body: JSON.stringify({ configurator: data!.slug, selections }),
        });
    };

    return {
        lines: [],
        catalog: {},
        view: 'overview',
        data: null,
        step: 'glass',
        selections: { glass: null, bulb: null, cable: null, driver: null, length: null, custom_length: null, base: null, base_color: 'zwart', composition: null, assembly: null },
        family: null,
        color: null,
        size: null,
        sizes: [],
        mixed: null,
        scene: 'none',
        person: false,
        pricing: null,
        busy: false,
        error: null,
        result: null,

        loadLines: async () => {
            const lines = await api<ConfiguratorLine[]>('/configurators');
            const all = await Promise.all(lines.map((line) => api<ConfiguratorData>(`/configurators/${line.slug}`)));
            set({ lines, catalog: Object.fromEntries(all.map((data) => [data.slug, data])) });

            // Een gedeelde link (?lijn=...&lamp=...) opent direct de configurator.
            const params = new URLSearchParams(window.location.search);
            const lamp = params.get('lamp');
            const line = params.get('lijn');
            if (lamp && line && get().catalog[line]) await get().openLamp(line, lamp, false);
        },

        openLamp: async (slug, family, push = true, color, size) => {
            await get().selectLine(slug);
            get().selectFamily(family, color, size);
            set({ view: 'configure', step: 'glass' });
            if (push) history.pushState(null, '', `?lijn=${encodeURIComponent(slug)}&lamp=${encodeURIComponent(family)}`);
            window.scrollTo({ top: 0 });
        },

        showOverview: (push = true) => {
            set({ view: 'overview' });
            if (push) history.pushState(null, '', window.location.pathname);
            window.scrollTo({ top: 0 });
        },

        selectLine: async (slug) => {
            const data = get().catalog[slug] ?? (await api<ConfiguratorData>(`/configurators/${slug}`));
            // Startpunt: eerste glas, 1,5 m en één lamp aan een canopy; bij Large (alleen platen) de kleinste plaat.
            const firstGlass = options(data, 'glass')[0];
            const base = options(data, 'base').find((o) => o.meta.lights === 1) ?? options(data, 'base')[0];
            const sizes = base?.meta.advised_sizes ?? Array.from({ length: base?.meta.lights ?? 1 }, () => 'M');

            set({ data, step: 'glass', pricing: null, result: null, error: null });
            update({
                family: firstGlass?.group ?? null,
                color: firstGlass?.meta.color ?? null,
                size: data.settings.glass_mode === 'sizes' ? null : (firstGlass?.meta.size ?? null),
                sizes,
                mixed: null,
                selections: {
                    glass: firstGlass?.key ?? null,
                    bulb: null,
                    cable: null,
                    driver: null,
                    length: data.cable_lengths[0] ?? 1.5,
                    custom_length: null,
                    base: base?.key ?? null,
                    base_color: 'zwart',
                    composition: null,
                    assembly: 'self',
                },
            });
        },

        goTo: (step) => set({ step }),

        selectFamily: (family, color, size) => {
            const state = get();
            if (!state.data) return;
            // Binnen dezelfde lamp blijft de andere keuze staan; bij een nieuwe lamp begin je bij de eerste uitvoering.
            const same = state.family === family;
            const variant = variantFor(state.data, family, color ?? (same ? state.color : null), size ?? (same ? state.size : null), size && !color ? 'size' : 'color');
            // Een kleur of maat kiezen maakt alle posities weer gelijk.
            update({
                family,
                color: variant?.meta.color ?? null,
                size: state.data.settings.glass_mode === 'sizes' ? null : (variant?.meta.size ?? null),
                mixed: null,
            });
        },

        startMix: () => {
            const keys = glassPerPosition(get()).map((g) => g?.key).filter(Boolean) as string[];
            update({ mixed: keys.length ? keys : null });
        },

        setMixed: (position, key) => {
            const mixed = [...(get().mixed ?? [])];
            mixed[position] = key;
            update({ mixed });
        },

        stopMix: () => update({ mixed: null }),

        setScene: (scene) => set({ scene }),

        togglePerson: () => set({ person: !get().person }),

        // Verdeling (5 x Ø40, 5 x Ø30, 5 x Ø20) om en om over de posities, zodat de maten door elkaar hangen zoals op de projectfoto's.
        distribute: (rows) => {
            const left = rows.filter((r) => r.count > 0).map((r) => ({ ...r }));
            const keys: string[] = [];
            while (left.some((r) => r.count > 0)) {
                for (const row of left) {
                    if (row.count > 0) {
                        keys.push(row.key);
                        row.count--;
                    }
                }
            }
            if (keys.length) update({ mixed: keys });
        },

        setSize: (position, size) => {
            const sizes = [...get().sizes];
            sizes[position] = size;
            update({ sizes });
        },

        selectBulb: (key) => update({ selections: { ...get().selections, bulb: key } }),

        selectCable: (key) => update({ selections: { ...get().selections, cable: key } }),

        selectDriver: (key) => update({ selections: { ...get().selections, driver: key } }),

        setLength: (length, custom = null) =>
            update({ selections: { ...get().selections, length, custom_length: length === 'custom' ? custom : null } }),

        selectBase: (key, color) => {
            const base = option(get().data, 'base', key);
            const lights = base?.meta.lights ?? 1;
            const current = get().sizes;
            const sizes = base?.meta.advised_sizes ?? Array.from({ length: lights }, (_, i) => current[i] ?? 'M');
            update({ sizes, selections: { ...get().selections, base: key, base_color: color ?? get().selections.base_color } });
        },

        selectComposition: (key) => update({ selections: { ...get().selections, composition: key } }),

        selectAssembly: (key) => update({ selections: { ...get().selections, assembly: key } }),

        addToCart: async () => {
            set({ busy: true, error: null });
            try {
                const configuration = await save();
                const { redirect_url } = await api<{ redirect_url: string }>(`/configurations/${configuration.uuid}/cart`, { method: 'POST' });
                window.location.href = redirect_url;
            } catch (e) {
                set({ error: (e as Error).message, busy: false });
            }
        },

        requestQuote: async (customer) => {
            set({ busy: true, error: null });
            try {
                const configuration = await save();
                await api(`/configurations/${configuration.uuid}/quote`, { method: 'POST', body: JSON.stringify(customer) });
                set({ result: { type: 'quote', uuid: configuration.uuid }, busy: false });
            } catch (e) {
                set({ error: (e as Error).message, busy: false });
            }
        },
    };
});
