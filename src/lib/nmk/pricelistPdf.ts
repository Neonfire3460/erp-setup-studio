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

// Positions in points, measured from NMK's Turtle AV Q4 2026 PDFs.
const L = {
  brandBox: { x: 37.9, y: 52.1, w: 236.1, h: 48.8 },
  entityBox: { x: 308.7, y: 44, w: 245.1, h: 101.6 },
  lineX: 36.1,
  lineY: [145.4, 159.5, 174.5, 189.5],
  table: { x: 34.6, top: 208, bottom: 67.3, widths: [114.9, 315, 93.1], head: 14.7, row: 25.05 },
  teal: [19, 187, 179] as [number, number, number],
  grid: [128, 128, 128] as [number, number, number],
};

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
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const lines = [
      input.title,
      `Prices are in ${input.currency} Currency`,
      input.termsLine,
      input.noticeLine,
    ].filter(Boolean);
    lines.forEach((t, i) => doc.text(t, L.lineX, L.lineY[i] ?? L.lineY[3]! + 15 * (i - 3)));
  };

  autoTable(doc, {
    startY: L.table.top,
    margin: {
      top: L.table.top,
      bottom: L.table.bottom,
      left: L.table.x,
      right: pageW - L.table.x - L.table.widths.reduce((a, b) => a + b, 0),
    },
    head: [["Item Code", "Description", "List Price"]],
    body: input.items.map((i) => [i.itemCode, i.description, money(i.retail)]),
    theme: "grid",
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [0, 0, 0],
      lineColor: L.grid,
      lineWidth: 0.72,
      cellPadding: { top: 3, bottom: 3, left: 1.5, right: 5 },
      valign: "middle",
      minCellHeight: L.table.row,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: L.teal,
      textColor: [0, 0, 0],
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
      if (d.section !== "body" || d.column.index !== 0) return;
      const text = d.cell.text.join("");
      doc.setFontSize(8.5);
      const room = L.table.widths[0]! - 6.5;
      const w = doc.getTextWidth(text);
      if (w > room) {
        d.cell.styles.fontSize = Math.max(6, Math.floor(((8.5 * room) / w) * 10) / 10);
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
