// erpFile.ts: the final ERP upload file. One workbook per entity (A3 Upload page), 20 columns in the
// order of NMK's ERP Upload Template, no formulas, codes stored as text so leading zeros stay.
// Uses SheetJS (pass the module in), so it works in the browser and in server functions (email attachment).
import { ERP_HEADERS, ERP_TEXT_COLUMNS, type ErpValues } from "./ticket";

type XLSXModule = {
  utils: {
    book_new: () => unknown;
    aoa_to_sheet: (rows: unknown[][]) => Record<string, unknown>;
    book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
    encode_cell: (c: { r: number; c: number }) => string;
  };
  write: (wb: unknown, opts: { type: "array" | "base64"; bookType: "xlsx" }) => unknown;
};

const TEXT = new Set<string>(ERP_TEXT_COLUMNS);

/** Header row + one row per item, every value typed (text or number). */
export function erpSheetRows(rows: ErpValues[]): (string | number | null)[][] {
  const out: (string | number | null)[][] = [[...ERP_HEADERS]];
  for (const r of rows) {
    out.push(
      ERP_HEADERS.map((h) => {
        const v = r[h];
        if (v === null || v === undefined || v === "") return null;
        if (TEXT.has(h)) return String(v);
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : String(v);
      }),
    );
  }
  return out;
}

/** "IR-2026-0001 NMK 001 Turtle AV.xlsx" */
export const erpFileName = (ticketNo: string, entityName: string, brand: string) =>
  `${ticketNo} ${entityName} ${brand}`.replace(/[\\/:*?"<>|]+/g, "-").trim() + ".xlsx";

/** Sheet name = entity name (31 characters max). */
export function buildErpWorkbook(
  XLSX: XLSXModule,
  sheets: { name: string; rows: ErpValues[] }[],
  type: "array" | "base64" = "array",
) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const aoa = erpSheetRows(s.rows);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Text cells get the "@" number format so Excel keeps them as text (02, 0205, 04).
    for (let r = 1; r < aoa.length; r++) {
      ERP_HEADERS.forEach((h, c) => {
        if (!TEXT.has(h)) return;
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as { t?: string; z?: string } | undefined;
        if (cell) {
          cell.t = "s";
          cell.z = "@";
        }
      });
    }
    ws["!cols"] = ERP_HEADERS.map((h) => ({ wch: /Description/.test(h) ? 40 : 14 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  }
  return XLSX.write(wb, { type, bookType: "xlsx" });
}
