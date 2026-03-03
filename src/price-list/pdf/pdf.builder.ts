/* eslint-disable @typescript-eslint/no-require-imports */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { PriceList } from '../entities/price-list.entity';

// pdfmake 0.3.x exports a singleton instance (not a constructor class)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
// vfs_fonts exports font buffers directly at root level: { 'Roboto-Regular.ttf': '<base64>', ... }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfs = require('pdfmake/build/vfs_fonts') as Record<string, string>;

// Register font files into the pdfmake virtual filesystem once at module load
Object.keys(vfs).forEach((key) => {
  pdfmake.virtualfs.writeFileSync(key, Buffer.from(vfs[key], 'base64'));
});

// Register Roboto font (supports Cyrillic)
pdfmake.addFonts({
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
});

const BRANDING_TEXT = 'Згенеровано за допомогою Прайс Крафт';

// ─── Image helpers ────────────────────────────────────────────────────────────

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ─── Number helpers ───────────────────────────────────────────────────────────

function n(val: unknown): number {
  return parseFloat(String(val ?? 0)) || 0;
}

function fmt(val: number): string {
  return val.toFixed(2);
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

export async function buildPriceListPdf(
  priceList: PriceList,
  mode: 'full' | 'public',
  siteUrl: string,
): Promise<Buffer> {
  const visibleItems = priceList.items.filter((i) => !i.isHidden);
  const allItems = priceList.items;
  // For totals: public mode uses only visible items; full mode uses all
  const itemsForTotals = mode === 'public' ? visibleItems : allItems;

  // Pre-fetch images in parallel
  const [logoData, ...photoDataArr] = await Promise.all([
    priceList.logoUrl
      ? fetchImageBase64(priceList.logoUrl)
      : Promise.resolve(null),
    ...priceList.photos.slice(0, 5).map((url) => fetchImageBase64(url)),
  ]);

  // ─── Compute totals ──────────────────────────────────────────────────────────

  const subtotal = itemsForTotals.reduce(
    (sum, item) => sum + n(item.quantity) * n(item.unitPrice),
    0,
  );
  const vatRate = n(priceList.vatRate);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  // ─── Build items table ────────────────────────────────────────────────────────

  // Items shown in the table (public: visible only; full: all with hidden marker)
  const tableItems = mode === 'public' ? visibleItems : allItems;

  // Collect unique visible column keys across all table items
  const allVisibleKeys: string[] = [];
  const seenKeys = new Set<string>();
  for (const item of tableItems) {
    for (const key of item.visibleColumnKeys) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allVisibleKeys.push(key);
      }
    }
  }

  // Header row
  const tableHeaders: Content[] = [
    { text: '№', style: 'tableHeader' },
    { text: 'Найменування', style: 'tableHeader' },
    ...allVisibleKeys.map((key) => {
      const label =
        tableItems.find((i) => i.columnLabels[key])?.columnLabels[key] ?? key;
      return { text: label, style: 'tableHeader' };
    }),
    { text: 'Кількість', style: 'tableHeader' },
    { text: 'Ціна/од.', style: 'tableHeader' },
    { text: 'Сума', style: 'tableHeader' },
    { text: 'Примітка', style: 'tableHeader' },
  ];

  // Data rows
  let rowNum = 0;
  const tableBody: Content[][] = tableItems.map((item) => {
    const hidden = item.isHidden;
    rowNum++;
    const cellStyle = hidden ? 'hiddenCell' : 'cell';
    const qty = n(item.quantity);
    const price = n(item.unitPrice);

    return [
      { text: String(rowNum), style: cellStyle },
      {
        text: hidden ? `[ПРИХОВАНА] ${item.name}` : item.name,
        style: cellStyle,
        italics: hidden,
      },
      ...allVisibleKeys.map((key) => ({
        text: item.visibleColumnKeys.includes(key)
          ? String(item.displayData[key] ?? '')
          : '—',
        style: cellStyle,
        italics: hidden,
      })),
      { text: fmt(qty), style: cellStyle, italics: hidden },
      { text: fmt(price), style: cellStyle, italics: hidden },
      { text: fmt(qty * price), style: cellStyle, italics: hidden },
      {
        text: item.note ?? '',
        style: cellStyle,
        italics: hidden,
        fontSize: 8,
      },
    ] as Content[];
  });

  // Column widths
  const colWidths: (number | string)[] = [
    20,
    '*',
    ...allVisibleKeys.map(() => '*' as string),
    45,
    55,
    55,
    60,
  ];

  // ─── Photos section ───────────────────────────────────────────────────────────

  const photosSection: Content[] = [];
  const validPhotos = photoDataArr.filter(Boolean) as string[];
  if (validPhotos.length > 0) {
    photosSection.push({
      columns: validPhotos.map((data) => ({
        image: data,
        width: Math.floor(500 / validPhotos.length) - 4,
        margin: [2, 0, 2, 0],
      })),
      margin: [0, 0, 0, 12],
    } as Content);
  }

  // ─── Header / footer ─────────────────────────────────────────────────────────

  const hasHeader = !!(priceList.headerText || priceList.logoUrl);

  const buildHeader = (): Content => {
    const cols: Content[] = [];
    if (logoData)
      cols.push({ image: logoData, width: 70, margin: [0, 5, 10, 5] });
    if (priceList.headerText)
      cols.push({
        text: priceList.headerText,
        style: 'headerText',
        margin: [0, 10, 0, 0],
      });
    if (cols.length === 0) return { text: '' };
    return { columns: cols, margin: [40, 15, 40, 5], columnGap: 10 };
  };

  const buildFooter = (currentPage: number, pageCount: number): Content => ({
    stack: [
      priceList.footerText
        ? {
            text: priceList.footerText,
            style: 'footerUserText',
            margin: [40, 0, 40, 4],
          }
        : { text: '' },
      {
        columns: [
          {
            text: `${BRANDING_TEXT} | ${siteUrl}`,
            link: siteUrl,
            style: 'branding',
          },
          {
            text: `Стор. ${currentPage} з ${pageCount}`,
            alignment: 'right',
            style: 'branding',
          },
        ],
        margin: [40, 0, 40, 8],
      },
    ],
  });

  // ─── Document definition ──────────────────────────────────────────────────────

  const docDefinition: TDocumentDefinitions = {
    pageMargins: [40, hasHeader ? 90 : 40, 40, 65],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    header: hasHeader ? buildHeader : undefined,
    footer: buildFooter,

    content: [
      ...photosSection,

      // Items table
      {
        table: {
          headerRows: 1,
          widths: colWidths,
          body: [tableHeaders, ...tableBody],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? '#f0f4f8' : rowIndex % 2 === 0 ? '#fafafa' : null,
        },
        margin: [0, 0, 0, 16],
      },

      // Totals
      {
        alignment: 'right',
        table: {
          widths: [160, 80],
          body: [
            [
              { text: 'Разом без ПДВ:', style: 'totalLabel' },
              { text: fmt(subtotal), style: 'totalValue' },
            ],
            [
              { text: `ПДВ (${fmt(vatRate)}%):`, style: 'totalLabel' },
              { text: fmt(vatAmount), style: 'totalValue' },
            ],
            [
              { text: 'Разом з ПДВ:', style: 'grandTotalLabel' },
              { text: fmt(total), style: 'grandTotalValue' },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      } as Content,

      // Notes
      priceList.notes
        ? ({
            stack: [
              {
                text: 'Примітки:',
                style: 'sectionTitle',
                margin: [0, 0, 0, 4],
              },
              { text: priceList.notes, style: 'notes' },
            ],
          } as Content)
        : { text: '' },
    ],

    styles: {
      headerText: { fontSize: 14, bold: true, color: '#1a1a2e' },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: '#1a1a2e',
        margin: [3, 4, 3, 4],
      },
      cell: { fontSize: 9, margin: [3, 3, 3, 3] },
      hiddenCell: { fontSize: 9, margin: [3, 3, 3, 3], color: '#999999' },
      totalLabel: { fontSize: 10, alignment: 'right', margin: [0, 2, 8, 2] },
      totalValue: { fontSize: 10, alignment: 'right', margin: [0, 2, 0, 2] },
      grandTotalLabel: {
        fontSize: 11,
        bold: true,
        alignment: 'right',
        margin: [0, 4, 8, 2],
      },
      grandTotalValue: {
        fontSize: 11,
        bold: true,
        alignment: 'right',
        margin: [0, 4, 0, 2],
      },
      sectionTitle: { fontSize: 10, bold: true, color: '#333' },
      notes: { fontSize: 9, color: '#444', lineHeight: 1.4 },
      footerUserText: { fontSize: 9, color: '#444' },
      branding: { fontSize: 7.5, color: '#888888', italics: true },
    },
  };

  // pdfmake 0.3.x: createPdf() → OutputDocument → getBuffer() returns Promise<Buffer>
  const doc = pdfmake.createPdf(docDefinition);
  return doc.getBuffer();
}
