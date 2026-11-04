/** 'cable' is geen eigen stap: de snoerkeuze staat in de stap Pendel. */
export type StepKey = 'glass' | 'bulb' | 'pendant' | 'base' | 'driver' | 'composition' | 'assembly' | 'cable';

export interface Option {
    key: string;
    name: string;
    group: string | null;
    sku: string | null;
    meta: Record<string, any>;
    price: number | null;
    image: string | null;
    /** Alleen bij plafondbases: prijs per kleur, null = op aanvraag. */
    finish_prices?: Record<string, number | null>;
}

export interface Component {
    key: StepKey;
    name: string;
    description: string | null;
    step: number;
    options: Option[];
}

export interface ConfiguratorLine {
    slug: string;
    name: string;
    description: string | null;
    settings: { voltage: string; glass_mode: 'single' | 'sizes' };
}

export interface ConfiguratorData extends ConfiguratorLine {
    cable_lengths: number[];
    cable_min: number;
    cable_max: number;
    /** Sfeerfoto's per lampfamilie (bestandsnaam begint met de naam van de lamp). */
    lifestyle: Record<string, string[]>;
    components: Component[];
}

export type Length = number | 'custom';

export type BaseColor = 'zwart' | 'wit' | 'brons' | 'rvs';

export interface Selections {
    glass: string | string[] | null;
    /** Sku van de lamp, 'none' = zonder, null = het advies bij het glas. */
    bulb: string | null;
    /** Sku van een snoer per meter, null = het standaardsnoer van de pendel. */
    cable: string | null;
    /** Sku van de driver (Milliamps), null = het advies. */
    driver: string | null;
    length: Length | null;
    custom_length: number | null;
    base: string | null;
    base_color: BaseColor;
    composition: string | null;
    assembly: 'self' | 'maretti' | null;
}

export interface BomItem {
    role: 'glass' | 'accessory' | 'pendant' | 'cable' | 'bulb' | 'driver' | 'base' | 'assembly';
    sku: string;
    description: string;
    quantity: number;
    unit_price: number | null;
    line_total: number | null;
    discontinued?: boolean;
}

export interface Pricing {
    items: BomItem[];
    total: number;
    lights: number;
    requires_assembly: boolean;
    quote_only: boolean;
    valid: boolean;
    errors: string[];
    warnings: string[];
    availability: Partial<Record<StepKey, Record<string, string | null>>>;
}

export interface Customer {
    name: string;
    company?: string;
    email: string;
    phone?: string;
    notes?: string;
}
