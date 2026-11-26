// pricelistPdf.ts: builds the brand + entity PDF pricelist in NMK's template layout (A4, brand logo left,
// entity logo right, four header lines, teal table header, footer with the confidential line, the entity's
// legal name and the page number). Deterministic: no AI, same data gives the same PDF.
// Pass jsPDF and autoTable in: import { jsPDF } from 'jspdf'; import { autoTable } from 'jspdf-autotable'.
import { money } from "./util";

export interface PdfLogo {
  dataUrl: string;
  width: number;
  height: number;
} // pixel size, for the aspect ratio
export interface PricelistItem {
  itemCode: string;
  description: string;
  retail: number;
  /** A section heading row ("Neat Accessories") instead of an item. */
  heading?: string;
}
export interface PricelistInput {
  title: string; // "Q4 2026 Price List"
  currency: string; // "AED"
  termsLine: string; // "Ex-works Dubai, UAE, DDP, VAT is extra"
  noticeLine: string; // "All prices are subject to change without prior notice"
  confidentialLine: string;
  legalName: string; // footer right
  brandLogo?: PdfLogo | null;
  entityLogo?: PdfLogo | null;
  items: PricelistItem[];
  /** Colours, column titles and layout. pdfStyleFor(brand) picks the brand's template. */
  style?: PdfStyle;
}

/** "Q4 2026 Price List" from a date. */
export const pricelistTitle = (d = new Date()) =>
  `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()} Price List`;

/** Items that would print badly: listed before the PDF is made (test T27). */
export function pricelistChecks(
  items: { itemCode: string; description: string; retail: number | null }[],
) {
  return items
    .filter((i) => !i.description.trim() || i.retail === null || !(i.retail > 0))
    .map((i) => ({
      itemCode: i.itemCode,
      problem: !i.description.trim() ? "No description" : "No retail price",
    }));
}

type RGB = [number, number, number];
type Box = { x: number; y: number; w: number; h: number };
export interface PdfLayout {
  brandBox: Box;
  entityBox: Box;
  lineX: number;
  lineY: number[];
  lineSize: number;
  bodySize: number;
  table: { x: number; top: number; bottom: number; widths: number[]; head: number; row: number };
}
export interface PdfStyle {
  headFill: RGB;
  headText: RGB;
  sectionFill: RGB;
  sectionText: RGB;
  columns: [string, string, string];
  /** "Q4 2026" in bold in the first header line (Neat). */
  boldQuarter: boolean;
  layout: PdfLayout;
}

// Positions in points, measured from NMK's Turtle AV Q4 2026 PDFs.
const L_STANDARD: PdfLayout = {
  brandBox: { x: 37.9, y: 52.1, w: 236.1, h: 48.8 },
  entityBox: { x: 308.7, y: 44, w: 245.1, h: 101.6 },
  lineX: 36.1,
  lineY: [145.4, 159.5, 174.5, 189.5],
  lineSize: 8.5,
  bodySize: 8.5,
  table: { x: 34.6, top: 208, bottom: 67.3, widths: [114.9, 315, 93.1], head: 14.7, row: 25.05 },
};
// Measured from NMK's Neat Q4 2026 PDFs: bigger brand logo, tighter header lines, wider code column.
const L_NEAT: PdfLayout = {
  brandBox: { x: 28.8, y: 50, w: 230, h: 66 },
  entityBox: { x: 330, y: 40, w: 230, h: 104 },
  lineX: 30.1,
  lineY: [141.6, 151.6, 161.7, 171.8],
  lineSize: 7.2,
  bodySize: 7.4,
  table: { x: 28.8, top: 184, bottom: 67.3, widths: [149.8, 308.4, 73.2], head: 16.5, row: 22 },
};

export const PDF_STANDARD: PdfStyle = {
  headFill: [19, 187, 179],
  headText: [0, 0, 0],
  sectionFill: [235, 235, 235],
  sectionText: [0, 0, 0],
  columns: ["Item Code", "Description", "List Price"],
  boldQuarter: false,
  layout: L_STANDARD,
};
/** Brand templates that differ from the standard teal one, by upper-case brand name. */
export const PDF_BRAND_STYLES: Record<string, PdfStyle> = {
  NEAT: {
    headFill: [112, 48, 160],
    headText: [255, 255, 255],
    sectionFill: [112, 48, 160],
    sectionText: [255, 255, 255],
    columns: ["Product Code", "Descriptions", "List Price"],
    boldQuarter: true,
    layout: L_NEAT,
  },
};

/** Admin overrides saved in app_settings "pdf_styles" (colours and column titles only). */
export interface PdfStyleOverride {
  headColor?: string; // "#7030A0"
  headTextWhite?: boolean;
  columns?: [string, string, string];
}

const hex = (h: string | undefined): RGB | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h ?? "");
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbHex = (c: RGB) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

export function pdfStyleFor(brand: string, o?: PdfStyleOverride | null): PdfStyle {
  const base = PDF_BRAND_STYLES[brand.trim().toUpperCase()] ?? PDF_STANDARD;
  if (!o) return base;
  const fill = hex(o.headColor);
  const text: RGB | null =
    o.headTextWhite === undefined ? null : o.headTextWhite ? [255, 255, 255] : [0, 0, 0];
  return {
    ...base,
    ...(fill
      ? { headFill: fill, sectionFill: base === PDF_STANDARD ? base.sectionFill : fill }
      : {}),
    ...(text ? { headText: text, ...(base === PDF_STANDARD ? {} : { sectionText: text }) } : {}),
    ...(o.columns?.every((c) => c.trim()) ? { columns: o.columns } : {}),
  };
}

const grid: RGB = [128, 128, 128];

function fit(
  box: { x: number; y: number; w: number; h: number },
  logo: PdfLogo,
  alignRight: boolean,
) {
  const s = Math.min(box.w / logo.width, box.h / logo.height);
  const w = logo.width * s,
    h = logo.height * s;
  return { x: alignRight ? box.x + box.w - w : box.x, y: box.y + (box.h - h) / 2, w, h };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPricelistPdf(jsPDF: any, autoTable: any, input: PricelistInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
  const pageW = doc.internal.pageSize.getWidth(),
    pageH = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: `${input.title} ${input.currency}`, creator: "NMK Unite" });
  const S = input.style ?? PDF_STANDARD;
  const L = S.layout;

  const header = () => {
    if (input.brandLogo) {
      const f = fit(L.brandBox, input.brandLogo, false);
      doc.addImage(input.brandLogo.dataUrl, "PNG", f.x, f.y, f.w, f.h, "brand", "FAST");
    }
    if (input.entityLogo) {
      const f = fit(L.entityBox, input.entityLogo, true);
      doc.addImage(input.entityLogo.dataUrl, "PNG", f.x, f.y, f.w, f.h, "entity", "FAST");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.lineSize);
    doc.setTextColor(0, 0, 0);
    const lines = [
      input.title,
      `Prices are in ${input.currency} Currency`,
      input.termsLine,
      input.noticeLine,
    ].filter(Boolean);
    const gap = (L.lineY[3]! - L.lineY[0]!) / 3;
    lines.forEach((t, i) => {
      const y = L.lineY[i] ?? L.lineY[3]! + gap * (i - 3);
      // "Q4 2026" in bold, then " Price List" (Neat).
      const q = i === 0 && S.boldQuarter ? /^(Q\d \d{4})(.*)$/.exec(t) : null;
      if (q) {
        doc.setFont("helvetica", "bold");
        doc.text(q[1]!, L.lineX, y);
        const w = doc.getTextWidth(q[1]!);
        doc.setFont("helvetica", "normal");
        doc.text(q[2]!, L.lineX + w, y);
      } else doc.text(t, L.lineX, y);
    });
  };

  autoTable(doc, {
    startY: L.table.top,
    margin: {
      top: L.table.top,
      bottom: L.table.bottom,
      left: L.table.x,
      right: pageW - L.table.x - L.table.widths.reduce((a, b) => a + b, 0),
    },
    head: [S.columns],
    body: input.items.map((i) =>
      i.heading
        ? [
            {
              content: i.heading,
              colSpan: 3,
              styles: {
                fontStyle: "bold",
                halign: "center",
                fillColor: S.sectionFill,
                textColor: S.sectionText,
                minCellHeight: L.table.head + 4,
              },
            },
          ]
        : [i.itemCode, i.description, money(i.retail)],
    ),
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: L.bodySize,
      textColor: [0, 0, 0],
      lineColor: grid,
      lineWidth: 0.72,
      cellPadding: { top: 3, bottom: 3, left: 1.5, right: 5 },
      valign: "middle",
      minCellHeight: L.table.row,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: S.headFill,
      textColor: S.headText,
      fontStyle: "bold",
      halign: "center",
      minCellHeight: L.table.head,
      cellPadding: 1,
    },
    columnStyles: {
      0: { cellWidth: L.table.widths[0] },
      1: { cellWidth: L.table.widths[1] },
      2: { cellWidth: L.table.widths[2], halign: "right" },
    },
    willDrawPage: () => header(),
    // Item codes never wrap: a long code (TAV-USBEXTKIT1-PROMO) gets a slightly smaller font instead.
    didParseCell: (d: {
      section: string;
      column: { index: number };
      cell: { text: string[]; styles: { fontSize: number; cellPadding: unknown } };
    }) => {
      if (
        d.section !== "body" ||
        d.column.index !== 0 ||
        (d.cell as { colSpan?: number }).colSpan! > 1
      )
        return;
      const text = d.cell.text.join("");
      doc.setFontSize(L.bodySize);
      const room = L.table.widths[0]! - 6.5;
      const w = doc.getTextWidth(text);
      if (w > room) {
        d.cell.styles.fontSize = Math.max(6, Math.floor(((L.bodySize * room) / w) * 10) / 10);
        d.cell.text = [text];
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.4);
    doc.setTextColor(0, 0, 0);
    doc.text(`Page ${p}`, pageW - 29.3, pageH - 33, { align: "right" });
    doc.text(input.confidentialLine, 29.3, pageH - 23);
    doc.text(input.legalName, pageW - 29.3, pageH - 23, { align: "right" });
  }
  return doc;
}

/** "Turtle AV Q4 2026 Price List NMK 001 AED.pdf" */
export const pricelistFileName = (
  brand: string,
  title: string,
  entityName: string,
  currency: string,
) => `${brand} ${title} ${entityName} ${currency}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
