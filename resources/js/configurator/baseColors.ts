import type { BaseColor } from './types';

/** Kleuren van de plafondbasis: rondje in de keuze en kleur in het 3D-voorbeeld. Brons en RVS zijn op aanvraag. */
export const BASE_COLORS: Record<BaseColor, { name: string; swatch: string; hex: string; metal: boolean }> = {
    zwart: { name: 'Zwart', swatch: '#111111', hex: '#111111', metal: false },
    wit: { name: 'Wit', swatch: '#ffffff', hex: '#f2f2f0', metal: false },
    brons: { name: 'Brons', swatch: 'linear-gradient(135deg, #a07a4a, #5e4426)', hex: '#8c6a3f', metal: true },
    rvs: { name: 'RVS', swatch: 'linear-gradient(135deg, #f1f3f4, #9aa1a6)', hex: '#c9ced2', metal: true },
};
