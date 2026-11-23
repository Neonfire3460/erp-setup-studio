// util.ts: small helpers shared by every NMK Unite module. No dependencies.
// Used in the browser (src/lib/nmk) and in backend functions (supabase/functions/_shared/nmk).

/** Text of a spreadsheet cell from SheetJS, ExcelJS, PapaParse or plain JSON. Always trimmed. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.replace(/\u00a0/g, " ").trim();
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as Record<string, unknown>;
  if (Array.isArray(o["richText"]))
    return (o["richText"] as { text: string }[])
      .map((t) => t.text)
      .join("")
      .trim();
  if ("result" in o) return cellText(o["result"]); // ExcelJS formula
  if ("text" in o) return cellText(o["text"]); // ExcelJS hyperlink
  if ("error" in o) return "";
  return String(v).trim();
}

/** A price or number typed by a person: "1,200.50", "1.200,50", "USD 95", "$95", 95. null when not a number. */
export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const o = v as Record<string, unknown>;
  if (o && typeof o === "object" && "result" in o) return parseNumber(o["result"]);
  let s = cellText(v).replace(/\s/g, "");
  if (!s) return null;
  s = s
    .replace(/^(AED|USD|EUR|SAR|QAR|GBP|SGD|MYR|IDR|CHF|\$|€|£)/i, "")
    .replace(/(AED|USD|EUR|SAR|QAR|GBP|SGD|MYR|IDR|CHF)$/i, "");
  if (/^-?[\d,]*\.?\d+$/.test(s))
    s = s.replace(/,/g, ""); // 1,200.50
  else if (/^-?[\d.]*,\d{1,2}$/.test(s))
    s = s.replace(/\./g, "").replace(",", "."); // 1.200,50
  else return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Item codes are compared trimmed and upper case. The original spelling is kept for output. */
export const codeKey = (code: unknown) => cellText(code).toUpperCase();

/** Gap 6: any item code that starts with "Demo" (any case) is never used anywhere. */
export const isDemoCode = (code: unknown) => /^demo/i.test(cellText(code));

/** Gap 1: Categories Data writes SubCategory as "AE01_L30127"; the ERP uses "L30127". */
export const stripAE01 = (code: unknown) => cellText(code).replace(/^AE01_/i, "");

/** "0205 - Media Processing & Control" -> { code: "0205", name: "Media Processing & Control" }. " - " -> empty. */
export function splitCodeName(v: unknown): { code: string; name: string } {
  const t = cellText(v);
  if (!t || t === "-") return { code: "", name: "" };
  const i = t.indexOf(" - ");
  if (i < 0) return /\s/.test(t) ? { code: "", name: t } : { code: t, name: "" };
  return { code: t.slice(0, i).trim(), name: t.slice(i + 3).trim() };
}

/**
 * Codes (family, group, category, midwich) must stay text so leading zeros survive ("02", "0205").
 * If a spreadsheet turned a code into a number we cannot know the lost zeros, so pass `width` when known.
 */
export function codeText(v: unknown, width = 0): string {
  const t = cellText(v);
  if (!t) return "";
  return width && /^\d+$/.test(t) && t.length < width ? t.padStart(width, "0") : t;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** 1042 -> "1,042.00" (PDF list price and screens). */
export const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percent change from old to new, 1 decimal. null when old is 0 or missing. */
export function pctChange(
  oldV: number | null | undefined,
  newV: number | null | undefined,
): number | null {
  if (oldV === null || oldV === undefined || newV === null || newV === undefined || oldV === 0)
    return null;
  return Math.round(((newV - oldV) / oldV) * 1000) / 10;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** IR-2026-0001 */
export const ticketNo = (year: number, seq: number) => `IR-${year}-${String(seq).padStart(4, "0")}`;
