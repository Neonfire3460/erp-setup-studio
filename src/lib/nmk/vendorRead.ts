// vendorRead.ts: Option A. Turns a vendor's Excel or PDF pricelist into tables, and a column mapping
// into wizard lines. The AI only picks which column is which (gap: AI never sets codes or prices):
// every code, description and price here comes from a real cell or PDF text item, with its sheet/page and row.
import type { PdfTextItem } from "./pdfOrder";
import type { Line } from "./types";
import { cellText, codeKey, isDemoCode, parseNumber, round2 } from "./util";

export interface VendorTable {
  name: string; // sheet name, or "PDF"
  headers: string[];
  rows: { cells: string[]; row: number; page?: number }[]; // row = sheet row number (1-based) or PDF line number
  conflicts: { page: number; row: number; shown: string; hidden: string }[]; // PDF text drawn over older text
}

export interface ColumnMapping {
  table: string;
  code: number; // column indexes into headers
  description: number | null;
  altCode: number | null;
  altDescription: number | null;
  cost: number | null; // the standard cost column
  entityCost: Record<string, number | null>; // own-cost entities
  discountPct: number; // cost = price × (1 − discount); 0 when the column already is the cost
  priceColumns: number[]; // every column that holds prices, for the "which is your cost" question
}

export const MAX_ROWS = 5000;
export const MAX_BYTES = 20 * 1024 * 1024;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
const looksLikeCode = (s: string) =>
  /^[A-Z0-9][A-Z0-9._/+-]{2,39}$/i.test(s) && /\d|-/.test(s) && !/^[\d.,]+$/.test(s);
const CODE_WORDS = /\b(item|part|sku|model|product|article|code|p n|pn|ref|reference|order)\b/;
const PRICE_WORDS =
  /\b(price|cost|msrp|rrp|srp|list|dealer|reseller|distributor|street|net|buy|map|usd|eur|aed|gbp|value)\b/;

/** Header signature: the same vendor layout gives the same signature, so its saved profile is reused. */
export const headerSignature = (t: Pick<VendorTable, "headers">) =>
  t.headers.map(norm).filter(Boolean).join("|");

// ---------- Excel ----------

/** One sheet (rows as arrays) -> a table. The header row is the first row that looks like column names. */
export function sheetTable(name: string, rows: unknown[][]): VendorTable | null {
  const text = rows.map((r) => (r ?? []).map((c) => cellText(c)));
  let best = -1,
    bestScore = 0;
  for (let i = 0; i < Math.min(text.length, 40); i++) {
    const cells = text[i]!.filter(Boolean);
    if (cells.length < 2) continue;
    const words = cells.filter((c) => parseNumber(c) === null).length;
    const score =
      words +
      (cells.some((c) => CODE_WORDS.test(norm(c))) ? 3 : 0) +
      (cells.some((c) => PRICE_WORDS.test(norm(c))) ? 3 : 0);
    if (words >= 2 && score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best < 0) return null;
  const headers = text[best]!.map((h, j) => h || `Column ${j + 1}`);
  const out: VendorTable["rows"] = [];
  for (let i = best + 1; i < text.length; i++) {
    const cells = headers.map((_, j) => text[i]![j] ?? "");
    if (cells.some(Boolean)) out.push({ cells, row: i + 1 });
  }
  return { name, headers, rows: out, conflicts: [] };
}

// ---------- PDF ----------

/**
 * PDF text items -> one table. Some PDFs keep an older text layer under the visible one (NMK's own PDFs:
 * 691.00 hidden under 769.00). The item drawn last at a spot is the one you see, so it wins; a different
 * value under it is reported as a conflict.
 */
export function pdfTable(items: (PdfTextItem & { w?: number })[]): VendorTable | null {
  const all = items.map((t, n) => ({ ...t, str: t.str.trim(), n })).filter((t) => t.str);
  // 1. drop text that a later item draws over (same page, same spot)
  const kept: typeof all = [];
  const hiddenUnder = new Map<number, string>(); // kept index n -> hidden text
  const byPage = new Map<number, typeof all>();
  for (const t of all) byPage.set(t.page, [...(byPage.get(t.page) ?? []), t]);
  for (const list of byPage.values()) {
    for (let i = 0; i < list.length; i++) {
      const t = list[i]!;
      const over = list
        .slice(i + 1)
        .find((u) => Math.abs(u.x - t.x) < 3 && Math.abs(u.y - t.y) < 3);
      if (over) {
        if (over.str !== t.str) hiddenUnder.set(over.n, t.str);
        continue;
      }
      kept.push(t);
    }
  }
  // 2. lines: same page, y within 2.5 pt
  kept.sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: (typeof kept)[] = [];
  for (const t of kept) {
    const last = lines.at(-1);
    if (last && last[0]!.page === t.page && Math.abs(last[0]!.y - t.y) <= 2.5) last.push(t);
    else lines.push([t]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  // 3. header line: has a code word and a price word
  const hi = lines.findIndex((l) => {
    const s = norm(l.map((t) => t.str).join(" "));
    return CODE_WORDS.test(s) && PRICE_WORDS.test(s);
  });
  if (hi < 0) return null;
  const head = lines[hi]!;
  const headers = head.map((t) => t.str);
  // Each text item goes to the header whose centre is nearest to its own centre (works for left, centred and
  // right-aligned columns alike).
  const mid = (t: { x: number; w?: number | undefined }) => t.x + (t.w ?? 0) / 2;
  const colFor = (t: { x: number; w?: number | undefined }) => {
    let best = 0,
      d = Infinity;
    head.forEach((h, j) => {
      const dd = Math.abs(mid(h) - mid(t));
      if (dd < d) {
        d = dd;
        best = j;
      }
    });
    return best;
  };
  const rows: VendorTable["rows"] = [];
  const conflicts: VendorTable["conflicts"] = [];
  lines.forEach((l, i) => {
    if (i <= hi) return;
    const s = l.map((t) => t.str).join(" ");
    if (headers.every((h) => s.includes(h)) && l.length >= headers.length) return; // header repeated on a later page
    const cells = headers.map(() => "");
    for (const t of l) {
      const c = colFor(t);
      cells[c] = cells[c] ? `${cells[c]} ${t.str}` : t.str;
    }
    if (!cells.some((c) => looksLikeCode(c))) return; // titles, footers
    rows.push({ cells, row: i + 1, page: l[0]!.page });
    for (const t of l) {
      const h = hiddenUnder.get(t.n);
      if (h !== undefined) conflicts.push({ page: t.page, row: i + 1, shown: t.str, hidden: h });
    }
  });
  return { name: "PDF", headers, rows, conflicts };
}

// ---------- mapping ----------

/** A first guess without the AI (also the fallback when the AI is not reachable). */
export function guessMapping(t: VendorTable): ColumnMapping {
  const h = t.headers.map(norm);
  const find = (re: RegExp, skip: number[] = []) => {
    const i = h.findIndex((x, j) => re.test(x) && !skip.includes(j));
    return i >= 0 ? i : null;
  };
  const codeCol = find(/\b(item code|part number|part no|sku|model|product code|code|item)\b/) ?? 0;
  const priceColumns = h
    .map((_, j) => j)
    .filter(
      (j) =>
        j !== codeCol &&
        PRICE_WORDS.test(h[j]!) &&
        t.rows.slice(0, 20).some((r) => parseNumber(r.cells[j]) !== null),
    );
  const cost =
    priceColumns.length === 1
      ? priceColumns[0]!
      : (priceColumns.find((j) => /\b(cost|net|dealer|reseller|buy)\b/.test(h[j]!)) ?? null);
  const altCode = find(/\b(alternative code|alt code|alternate code|ean|upc)\b/, [codeCol]);
  const altDescription = find(
    /\b(alternative description|alternate description|alt description|long description|details?)\b/,
    [codeCol],
  );
  const description = find(/\b(description|desc|product name|name)\b/, [
    codeCol,
    altDescription ?? -1,
  ]);
  return {
    table: t.name,
    code: codeCol,
    description,
    altCode,
    altDescription,
    cost,
    entityCost: {},
    discountPct: 0,
    priceColumns,
  };
}

export interface VendorLine extends Line {
  flags: string[]; // shown in amber on the review table
}

/** Applies the mapping to every row. Codes, descriptions and prices are copied from the cells. */
export function applyMapping(t: VendorTable, m: ColumnMapping, opts: { ownCost: string[] }) {
  const cell = (r: VendorTable["rows"][number], j: number | null) =>
    j === null || j === undefined ? "" : (r.cells[j] ?? "").trim();
  const price = (r: VendorTable["rows"][number], j: number | null | undefined) => {
    const raw = cell(r, j ?? null);
    if (/^(poa|p\.o\.a\.?|tba|tbc|call|on request|price on request)$/i.test(raw))
      return { value: 0, poa: true, raw };
    const n = parseNumber(raw);
    return { value: n === null ? null : round2(n * (1 - m.discountPct / 100)), poa: false, raw };
  };
  const lines: VendorLine[] = [];
  const seen = new Set<string>();
  const demo: string[] = [];
  for (const r of t.rows) {
    const code = cell(r, m.code);
    if (!code || !looksLikeCode(code)) continue;
    if (isDemoCode(code)) {
      demo.push(code);
      continue;
    }
    const flags: string[] = [];
    const std = price(r, m.cost);
    if (std.poa) flags.push("Price on request");
    else if (std.value === null) flags.push(std.raw ? `Not a price: "${std.raw}"` : "No price");
    if (seen.has(codeKey(code))) flags.push("Code repeated in the file");
    seen.add(codeKey(code));
    const entityCosts: Record<string, number | null> = {};
    for (const e of opts.ownCost) {
      const p = price(r, m.entityCost[e] ?? null);
      entityCosts[e] = p.value;
      if (p.value === null) flags.push(`No ${e} price`);
    }
    const hidden = t.conflicts.filter((c) => c.row === r.row && c.page === r.page);
    for (const c of hidden) flags.push(`Hidden older text under ${c.shown}: ${c.hidden}`);
    lines.push({
      lineNo: lines.length + 1,
      itemCode: code,
      altCode: cell(r, m.altCode),
      description: cell(r, m.description),
      altDescription: cell(r, m.altDescription),
      cost: std.value,
      entityCosts,
      priceOnRequest: std.poa,
      source: {
        ...(t.name !== "PDF" ? { sheet: t.name } : {}),
        row: r.row,
        ...(r.page ? { page: r.page } : {}),
      },
      flags,
    });
  }
  return { lines, demoSkipped: demo, tooMany: lines.length > MAX_ROWS };
}

/** The small part of a table the AI sees: headers and a few sample rows (never the whole file). */
export const aiSample = (t: VendorTable, n = 8) => ({
  name: t.name,
  headers: t.headers,
  samples: t.rows.slice(0, n).map((r) => r.cells),
});
