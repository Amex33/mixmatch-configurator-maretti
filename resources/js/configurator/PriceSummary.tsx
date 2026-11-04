import { useState } from 'react';
import { assetUrl, getViewerCanvas, useConfigurator } from './stores/configuratorStore';
import type { BomItem, Customer } from './types';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
export const formatPrice = (value: number) => euro.format(value);

const ROLES: Record<BomItem['role'], string> = { glass: 'Glas / kap', accessory: 'Accessoire', pendant: 'Pendel', cable: 'Snoer (meter)', driver: 'Driver', bulb: 'Lichtbron', base: 'Plafondbasis', assembly: 'Montage' };

function QuoteForm({ onCancel }: { onCancel: () => void }) {
    const requestQuote = useConfigurator((s) => s.requestQuote);
    const busy = useConfigurator((s) => s.busy);
    const [customer, setCustomer] = useState<Customer>({ name: '', email: '' });
    const field = (key: keyof Customer, label: string, type = 'text', required = false) => (
        <label className="block text-sm text-gray-700">
            {label}
            {required && ' *'}
            <input
                type={type}
                required={required}
                value={customer[key] ?? ''}
                onChange={(e) => setCustomer({ ...customer, [key]: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
        </label>
    );

    return (
        <form
            className="space-y-3"
            onSubmit={(e) => {
                e.preventDefault();
                requestQuote(customer);
            }}
        >
            {field('name', 'Naam', 'text', true)}
            {field('company', 'Bedrijf')}
            {field('email', 'E-mail', 'email', true)}
            {field('phone', 'Telefoon', 'tel')}
            <label className="block text-sm text-gray-700">
                Opmerkingen
                <textarea
                    value={customer.notes ?? ''}
                    onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
            </label>
            <div className="flex gap-2">
                <button type="submit" disabled={busy} className="flex-1 rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    Offerte versturen
                </button>
                <button type="button" onClick={onCancel} className="rounded-full border border-gray-300 px-4 py-2 text-sm">
                    Terug
                </button>
            </div>
        </form>
    );
}

export default function PriceSummary() {
    const pricing = useConfigurator((s) => s.pricing);
    const busy = useConfigurator((s) => s.busy);
    const error = useConfigurator((s) => s.error);
    const result = useConfigurator((s) => s.result);
    const addToCart = useConfigurator((s) => s.addToCart);
    const [quote, setQuote] = useState(false);

    if (result?.type === 'quote') {
        return (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="font-medium text-gray-950">Bedankt voor je aanvraag</p>
                <p className="mt-2 text-sm text-gray-600">We sturen je zo snel mogelijk een offerte. Je referentie: <span className="font-mono">{result.uuid.slice(0, 8)}</span></p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Jouw armatuur</p>

            {pricing && (
                <>
                    <ul className="mt-4 divide-y divide-gray-100 text-sm">
                        {pricing.items.map((item) => (
                            <li key={`${item.role}-${item.sku}`} className="flex justify-between gap-3 py-2">
                                <span>
                                    <span className="block text-gray-950">
                                        {item.quantity} x {ROLES[item.role]}
                                    </span>
                                    <span className="block text-xs text-gray-500">
                                        {item.description} · <span className="font-mono">{item.sku}</span>
                                    </span>
                                </span>
                                <span className="shrink-0 text-gray-950">{item.line_total !== null ? formatPrice(item.line_total) : 'op aanvraag'}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-4 flex items-baseline justify-between border-t border-gray-200 pt-4">
                        <span className="text-sm text-gray-600">Totaal excl. btw</span>
                        <span className="text-xl font-medium text-gray-950">{pricing.quote_only ? 'Op aanvraag' : formatPrice(pricing.total)}</span>
                    </div>

                    {[...pricing.errors, ...pricing.warnings].map((message) => (
                        <p key={message} className={`mt-3 text-xs ${pricing.errors.includes(message) ? 'text-red-600' : 'text-amber-700'}`}>
                            {message}
                        </p>
                    ))}
                </>
            )}

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <div className="mt-6">
                {quote ? (
                    <QuoteForm onCancel={() => setQuote(false)} />
                ) : (
                    <div className="flex flex-col gap-2">
                        {!pricing?.quote_only && (
                            <button
                                type="button"
                                onClick={addToCart}
                                disabled={busy || !pricing?.valid}
                                className="rounded-full bg-gray-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                            >
                                In winkelmand
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setQuote(true)}
                            disabled={!pricing?.valid}
                            className="rounded-full border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-950 disabled:opacity-40"
                        >
                            Offerte aanvragen
                        </button>
                    </div>
                )}
            </div>

            <DownloadButtons />
        </div>
    );
}

/** Ontwerp bewaren: het 3D-beeld als PNG, of een PDF met beeld, stuklijst en prijs. */
function DownloadButtons() {
    const pricing = useConfigurator((s) => s.pricing);
    const family = useConfigurator((s) => s.family);
    const data = useConfigurator((s) => s.data);
    const [busy, setBusy] = useState(false);

    const run = async (kind: 'png' | 'pdf') => {
        const canvas = getViewerCanvas();
        if (!canvas) return;
        const title = `${family ?? 'Mix & Match'}`;
        setBusy(true);
        try {
            const { downloadPdf, downloadPng } = await import('./exportDesign');
            if (kind === 'png') downloadPng(canvas, title);
            else await downloadPdf(canvas, title, data?.name ?? '', pricing, assetUrl('/images/configurator/maretti-logo-zwart.svg'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs text-gray-500">Ontwerp downloaden</p>
            <div className="flex gap-2">
                {(['png', 'pdf'] as const).map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        disabled={busy}
                        onClick={() => run(kind)}
                        className="flex-1 rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-950 hover:border-gray-950 disabled:opacity-40"
                    >
                        {kind.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
}
