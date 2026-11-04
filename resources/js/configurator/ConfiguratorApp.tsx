import { Suspense, lazy, useEffect, useState } from 'react';
import ComponentSelector from './ComponentSelector';
import LampOverview from './LampOverview';
import MaterialSelector from './MaterialSelector';
import PriceSummary from './PriceSummary';
import { STEPS, assetUrl, useConfigurator, type Scene } from './stores/configuratorStore';

// three.js is groot; los laden zodat de keuzes direct zichtbaar zijn.
const Viewer3D = lazy(() => import('./Viewer3D'));

const SCENES: [Scene, string][] = [
    ['none', 'Alleen lamp'],
    ['dining', 'Eettafel'],
    ['coffee', 'Salontafel'],
    ['stairs', 'Trap in vide'],
];

/**
 * Sfeerfoto's van projecten met deze lamp, onder het 3D-voorbeeld (in elke stap zichtbaar). Klik = groot bekijken.
 * Een foto hoort bij een lamp als de bestandsnaam in images/configurator/lifestyle met de naam van de lamp begint.
 */
function Inspiration({ photos, family }: { photos: string[]; family: string }) {
    const [open, setOpen] = useState<number | null>(null);
    if (!photos.length) return null;
    const step = (delta: number) => setOpen((i) => (i === null ? null : (i + delta + photos.length) % photos.length));

    return (
        <div>
            <p className="mb-2 text-sm font-medium text-gray-950">Inspiratie: {family} in projecten</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, i) => (
                    <button key={photo} type="button" onClick={() => setOpen(i)} className="shrink-0 overflow-hidden rounded-lg ring-gray-950 hover:ring-2">
                        <img src={photo} alt={`${family} in een project`} className="h-20 w-28 object-cover" loading="lazy" />
                    </button>
                ))}
            </div>

            {open !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${family} in een project`}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setOpen(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setOpen(null);
                        if (e.key === 'ArrowRight') step(1);
                        if (e.key === 'ArrowLeft') step(-1);
                    }}
                    tabIndex={-1}
                    ref={(el) => el?.focus()}
                >
                    <img src={photos[open]} alt={`${family} in een project`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
                    {photos.length > 1 && (
                        <>
                            <button type="button" aria-label="Vorige foto" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-4 rounded-full bg-white/90 px-3 py-2 text-gray-950">
                                ←
                            </button>
                            <button type="button" aria-label="Volgende foto" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-4 rounded-full bg-white/90 px-3 py-2 text-gray-950">
                                →
                            </button>
                        </>
                    )}
                    <button type="button" aria-label="Sluiten" onClick={() => setOpen(null)} className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1.5 text-sm text-gray-950">
                        Sluiten
                    </button>
                </div>
            )}
        </div>
    );
}

/** Zwart Maretti-logo met link naar de website. */
function Logo() {
    return (
        <a href="https://www.maretti.com" className="inline-block" aria-label="Maretti Lighting, naar de website">
            <img src={assetUrl('/images/configurator/maretti-logo-zwart.svg')} alt="Maretti Lighting" className="h-10 w-auto sm:h-12" />
        </a>
    );
}

export default function ConfiguratorApp() {
    const data = useConfigurator((s) => s.data);
    const step = useConfigurator((s) => s.step);
    const error = useConfigurator((s) => s.error);
    const loadLines = useConfigurator((s) => s.loadLines);
    const goTo = useConfigurator((s) => s.goTo);
    const view = useConfigurator((s) => s.view);
    const catalog = useConfigurator((s) => s.catalog);
    const openLamp = useConfigurator((s) => s.openLamp);
    const showOverview = useConfigurator((s) => s.showOverview);
    const family = useConfigurator((s) => s.family);
    const scene = useConfigurator((s) => s.scene);
    const setScene = useConfigurator((s) => s.setScene);
    const person = useConfigurator((s) => s.person);
    const togglePerson = useConfigurator((s) => s.togglePerson);

    useEffect(() => {
        loadLines().catch((e) => useConfigurator.setState({ error: e.message }));
    }, [loadLines]);

    // Terug-knop van de browser: wisselen tussen het overzicht en een lamp.
    useEffect(() => {
        const onPopState = () => {
            const params = new URLSearchParams(window.location.search);
            const lamp = params.get('lamp');
            const line = params.get('lijn');
            if (lamp && line) openLamp(line, lamp, false);
            else showOverview(false);
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [openLamp, showOverview]);

    const component = data?.components.find((c) => c.key === step);
    // Alleen de stappen die deze lijn heeft (de driver alleen bij Milliamps).
    const steps = STEPS.filter((key) => data?.components.some((c) => c.key === key));
    const index = steps.indexOf(step);
    const loaded = Object.keys(catalog).length > 0;

    if (view === 'overview') {
        return (
            <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
                <div className="flex justify-center">
                    <Logo />
                </div>
                <p className="mt-6 font-mono text-xs/5 font-semibold tracking-widest text-gray-500 uppercase">Mix &amp; Match</p>
                <h1 className="mt-2 text-4xl font-medium tracking-tighter text-gray-950 sm:text-5xl">Kies je lamp</h1>
                <p className="mt-3 max-w-2xl text-gray-600">Kies een lamp om te beginnen. Daarna stel je de lichtbron, pendel, plafondbasis en compositie samen en zie je het resultaat in 3D.</p>
                <div className="mt-8">
                    {loaded ? <LampOverview /> : <p className={error ? 'text-red-600' : 'text-gray-500'}>{error ?? 'Lampen laden...'}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
            {/* Terugknop links, logo in het midden. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <button type="button" onClick={() => showOverview()} className="justify-self-start text-sm text-gray-600 hover:text-gray-950">
                    ← Alle lampen
                </button>
                <Logo />
            </div>
            <p className="mt-4 font-mono text-xs/5 font-semibold tracking-widest text-gray-500 uppercase">Mix &amp; Match</p>
            <h1 className="mt-2 text-4xl font-medium tracking-tighter text-gray-950 sm:text-5xl">{family ?? 'Ontwerp je eigen verlichting'}</h1>

            {/* De lijn volgt uit de gekozen lamp; een andere lamp kies je via het overzicht. */}
            {data && <p className="mt-2 text-sm text-gray-500">{data.name}</p>}

            {!data && !error && <p className="mt-10 text-gray-500">Configurator laden...</p>}
            {!data && error && <p className="mt-10 text-red-600">{error}</p>}

            {data && (
                <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
                    <div className="space-y-6">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#f3f1ed]">
                            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-500">3D-voorbeeld laden...</div>}>
                                <Viewer3D />
                            </Suspense>
                            {/* Sfeer: de lamp boven een eettafel, salontafel of in een vide met trap. */}
                            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                                {SCENES.map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setScene(key)}
                                        className={`rounded-full px-3 py-1 text-xs font-medium backdrop-blur ${scene === key ? 'bg-gray-950 text-white' : 'bg-white/80 text-gray-950 hover:bg-white'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={togglePerson}
                                    aria-pressed={person}
                                    className={`rounded-full px-3 py-1 text-xs font-medium backdrop-blur ${person ? 'bg-gray-950 text-white' : 'bg-white/80 text-gray-950 hover:bg-white'}`}
                                >
                                    Persoon 1,68 m
                                </button>
                            </div>
                        </div>

                        {family && <Inspiration photos={data.lifestyle?.[family] ?? []} family={family} />}

                        <ol className="flex flex-wrap gap-2">
                            {data.components.filter((c) => STEPS.includes(c.key)).map((c) => (
                                <li key={c.key}>
                                    <button
                                        type="button"
                                        onClick={() => goTo(c.key)}
                                        className={`rounded-full border px-3 py-1.5 text-sm ${step === c.key ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}
                                    >
                                        {c.step}. {c.name}
                                    </button>
                                </li>
                            ))}
                        </ol>

                        {component && (
                            <section>
                                <h2 className="text-2xl font-medium tracking-tight text-gray-950">
                                    Stap {component.step}: {component.name}
                                </h2>
                                {component.description && <p className="mt-1 mb-5 max-w-2xl text-sm text-gray-600">{component.description}</p>}
                                {step === 'glass' ? <MaterialSelector /> : <ComponentSelector step={step} />}
                            </section>
                        )}

                        <div className="flex justify-between">
                            <button type="button" disabled={index <= 0} onClick={() => goTo(steps[index - 1])} className="text-sm text-gray-700 disabled:opacity-30">
                                ← Vorige
                            </button>
                            <button
                                type="button"
                                disabled={index === steps.length - 1}
                                onClick={() => goTo(steps[index + 1])}
                                className="rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-30"
                            >
                                Volgende stap →
                            </button>
                        </div>
                    </div>

                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <PriceSummary />
                    </aside>
                </div>
            )}
        </div>
    );
}
