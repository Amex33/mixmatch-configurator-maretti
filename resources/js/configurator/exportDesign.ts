import type { BomItem, Pricing } from './types';

/*
 * Ontwerp downloaden: het 3D-beeld als PNG, of een PDF met het beeld, de stuklijst en de prijs.
 * pdf-lib wordt pas geladen als iemand op "PDF" klikt, zodat de configurator zelf niet zwaarder wordt.
 */

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function download(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}

export function downloadPng(canvas: HTMLCanvasElement, title: string) {
    download(canvas.toDataURL('image/png'), `maretti-mix-match-${slug(title)}.png`);
}

const ROLE_NAMES: Record<BomItem['role'], string> = {
    glass: 'Glas / kap', accessory: 'Accessoire', pendant: 'Pendel', cable: 'Snoer (meter)', driver: 'Driver', bulb: 'Lichtbron', base: 'Plafondbasis', assembly: 'Montage',
};

const WEBSITE = 'https://www.maretti.com';
const CONTACT = 'Maretti Lighting  ·  Bolderweg 7, 1332 AX Almere  ·  036 532 66 12  ·  postbus@maretti.com  ·  www.maretti.com';

/** Het zwarte Maretti-logo (SVG) als PNG, want pdf-lib kan geen SVG insluiten. */
async function logoPng(url: string): Promise<string | null> {
    try {
        const svg = await (await fetch(url)).text();
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        await image.decode();
        // Verhouding uit de viewBox van het logo; 8x zo groot als de viewBox voor een scherpe afdruk.
        const [, , w, h] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 377 99').split(/\s+/).map(Number);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * 8);
        canvas.height = Math.round(h * 8);
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(image.src);
        return canvas.toDataURL('image/png');
    } catch {
        return null; // zonder logo gaat de PDF gewoon door
    }
}

export async function downloadPdf(canvas: HTMLCanvasElement, title: string, line: string, pricing: Pricing | null, logoUrl: string) {
    const { PDFDocument, PDFString, StandardFonts, rgb } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4 staand, in punten
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const grey = rgb(0.42, 0.42, 0.42);
    const margin = 48;
    const width = page.getWidth() - margin * 2;
    let y = page.getHeight() - margin;

    // Standaardlettertypen kennen alleen westerse tekens; Ø en € bestaan wel, andere tekens vervangen we.
    const safe = (text: string) => text.replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC]/g, '-');
    const text = (value: string, x: number, size = 10, font = regular, color = rgb(0.07, 0.07, 0.07)) => page.drawText(safe(value), { x, y, size, font, color });

    // Klikbaar gebied in de PDF dat naar de website gaat.
    const link = (x1: number, y1: number, x2: number, y2: number) => {
        const annotation = pdf.context.obj({
            Type: 'Annot', Subtype: 'Link', Rect: [x1, y1, x2, y2], Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: PDFString.of(WEBSITE) },
        });
        page.node.addAnnot(pdf.context.register(annotation));
    };

    // Logo bovenaan in het midden, met link naar de website
    const logo = await logoPng(logoUrl);
    if (logo) {
        const image = await pdf.embedPng(logo);
        const logoWidth = 160;
        const logoHeight = (image.height / image.width) * logoWidth;
        const x = (page.getWidth() - logoWidth) / 2;
        page.drawImage(image, { x, y: y - logoHeight, width: logoWidth, height: logoHeight });
        link(x, y - logoHeight, x + logoWidth, y);
        y -= logoHeight + 22;
    }

    text('MIX & MATCH', margin, 9, bold, grey);
    y -= 26;
    text(title, margin, 22, bold);
    y -= 16;
    text(`${line}  ·  ${new Date().toLocaleDateString('nl-NL')}`, margin, 10, regular, grey);
    y -= 14;

    // 3D-beeld, passend in de breedte
    const image = await pdf.embedPng(canvas.toDataURL('image/png'));
    const scale = width / image.width;
    const height = Math.min(image.height * scale, 330);
    y -= height;
    page.drawImage(image, { x: margin, y, width: (height / image.height) * image.width, height });
    y -= 28;

    text('Stuklijst', margin, 12, bold);
    y -= 18;
    for (const item of pricing?.items ?? []) {
        if (y < 150) break; // past niet meer op één pagina; de volledige stuklijst staat in de offerte
        text(`${item.quantity} x`, margin, 9);
        text(ROLE_NAMES[item.role] ?? item.role, margin + 34, 9, bold);
        text(item.line_total !== null ? euro.format(item.line_total) : 'op aanvraag', margin + width - 70, 9);
        y -= 12;
        text(`${item.description} · ${item.sku}`, margin + 34, 8, regular, grey);
        y -= 16;
    }

    y -= 6;
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: margin + width, y: y + 10 }, thickness: 0.5, color: grey });
    text('Totaal excl. btw', margin, 11, bold);
    text(pricing ? (pricing.quote_only ? 'Op aanvraag' : euro.format(pricing.total)) : '-', margin + width - 70, 11, bold);
    y -= 22;
    for (const warning of pricing?.warnings ?? []) {
        if (y < 76) break;
        text(warning.slice(0, 110), margin, 8, regular, grey);
        y -= 12;
    }

    // Voettekst: contactgegevens in het midden, met link naar de website
    y = 52;
    page.drawLine({ start: { x: margin, y: y + 14 }, end: { x: margin + width, y: y + 14 }, thickness: 0.5, color: grey });
    const contactWidth = regular.widthOfTextAtSize(safe(CONTACT), 8);
    text(CONTACT, (page.getWidth() - contactWidth) / 2, 8, regular);
    link((page.getWidth() - contactWidth) / 2, y - 2, (page.getWidth() + contactWidth) / 2, y + 9);
    y = 36;
    const note = 'Prijzen excl. btw en onder voorbehoud. Het 3D-beeld is een impressie; sfeerobjecten horen niet bij de bestelling.';
    text(note, (page.getWidth() - regular.widthOfTextAtSize(note, 7)) / 2, 7, regular, grey);

    const bytes = await pdf.save();
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
    download(url, `maretti-mix-match-${slug(title)}.pdf`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
