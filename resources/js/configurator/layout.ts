import type { Option } from './types';

/** Een ophangpunt in meters: x/z op het plafond, y is de hoogte van het ophangpunt (0 = plafond). */
export interface Anchor {
    x: number;
    z: number;
    y: number;
}

const mm = (value: number | undefined, fallback: number) => (value ?? fallback) / 1000;

/** Verdeelt de lichtpunten over de gekozen plafondbasis. */
export function anchors(base: Option | undefined): Anchor[] {
    if (!base) return [{ x: 0, z: 0, y: 0 }];

    const { type, shape, lights } = base.meta as { type: string; shape: string; lights: number };

    if (lights <= 1) return [{ x: 0, z: 0, y: 0 }];

    if (type === 'spreader' || type === 'spider') {
        const r = mm(base.meta.diameter, 600) / 2;
        // Spreader hangt net onder de canopy; de armen van een spider lopen schuin naar beneden.
        const y = type === 'spreader' ? -0.12 : -0.25;
        return rings(lights, r).map(([x, z]) => ({ x, z, y }));
    }

    if (shape === 'round') {
        return sunflower(lights, (mm(base.meta.diameter, 600) / 2) * 0.82).map(([x, z]) => ({ x, z, y: -0.03 }));
    }

    if (shape === 'square') {
        const side = Math.ceil(Math.sqrt(lights));
        const spacing = mm(base.meta.spacing, mm(base.meta.width, 450) * 1000 / (side + 1));
        const offset = ((side - 1) * spacing) / 2;
        return Array.from({ length: lights }, (_, i) => ({
            x: (i % side) * spacing - offset,
            z: Math.floor(i / side) * spacing - offset,
            y: -0.03,
        }));
    }

    // Rechthoekige plaat: smalle platen één rij, bredere platen zigzag over twee rijen.
    const width = mm(base.meta.width, 1200);
    const depth = mm(base.meta.depth, 300);
    const margin = Math.min(0.15, width / (lights * 2));
    const step = (width - margin * 2) / (lights - 1);
    const twoRows = depth >= 0.25;

    return Array.from({ length: lights }, (_, i) => ({
        x: -width / 2 + margin + i * step,
        z: twoRows ? (i % 2 === 0 ? -1 : 1) * depth / 4 : 0,
        y: -0.03,
    }));
}

/**
 * Hoogte van de onderkant van elk glas, volgens de compositie.
 * Snoerlengte = afstand plafond tot onderkant van het laagste glas.
 */
export function drops(points: Anchor[], composition: string | null, cableLength: number): number[] {
    const n = points.length;
    const spread = Math.min(0.6, cableLength * 0.35);
    const lowest = -cableLength;

    if (n <= 1 || composition === 'straight' || !composition) return points.map(() => lowest);

    if (composition === 'v-shape') {
        const dist = points.map((p) => Math.hypot(p.x, p.z));
        const max = Math.max(...dist) || 1;
        return dist.map((d) => lowest + spread * (d / max));
    }

    if (composition === 'swirl') {
        const order = points
            .map((p, i) => ({ i, angle: Math.atan2(p.z, p.x) }))
            .sort((a, b) => a.angle - b.angle)
            .map((p) => p.i);
        const result = new Array<number>(n);
        order.forEach((index, rank) => (result[index] = lowest + spread * (1 - rank / (n - 1))));
        return result;
    }

    // Random, maar elke keer hetzelfde voor hetzelfde aantal lichten.
    return points.map((_, i) => (i === Math.floor(n / 2) ? lowest : lowest + spread * pseudoRandom(i + n * 7)));
}

function rings(n: number, radius: number): [number, number][] {
    const outer = n > 6 ? Math.ceil(n * 0.6) : n;
    const inner = n - outer;
    const ring = (count: number, r: number, phase: number) =>
        Array.from({ length: count }, (_, i): [number, number] => {
            const a = phase + (i / count) * Math.PI * 2;
            return [Math.cos(a) * r, Math.sin(a) * r];
        });
    return [...ring(outer, radius, 0), ...ring(inner, radius * 0.5, Math.PI / Math.max(inner, 1))];
}

function sunflower(n: number, radius: number): [number, number][] {
    const golden = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: n }, (_, i) => {
        const r = radius * Math.sqrt((i + 0.5) / n);
        return [Math.cos(i * golden) * r, Math.sin(i * golden) * r];
    });
}

function pseudoRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}
