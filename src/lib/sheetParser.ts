// @ts-nocheck -- vendored verbatim from the spec; logic unchanged, project strict flags not applied.
// sheetParser.ts
// Pure logic for reading vendor pricelists. No UI, no network, no AI.
// The AI only proposes a SheetMapping; every value is copied from the cells by this file.
// Tested on real Lightware (AED and USD) and Midwich SEA pricelists.

export type Cell = string | number | null;
export type Grid = Cell[][]; // grid[r][c], zero-based. Excel row number = r + 1

export interface SheetData {
  name: string;
  hidden: boolean;
  grid: Grid;
}

export interface SheetMapping {
  headerRow: number;             // Excel row number (1-based) of the first header row
  itemCode: string;              // column letters, e.g. "B"
  price: string;                 // the ONE price column to extract
  altCode?: string | null;
  description?: string | null;
  detDescription?: string | null;
  unit?: string | null;
  notes?: string | null;
}

export type RowKind = 'item' | 'category' | 'blank' | 'header' | 'note' | 'duplicate' | 'exception';

export interface ParsedRow {
  sheet: string;
  row: number;                   // Excel row number
  kind: RowKind;
  reason?: string;               // why it was skipped or flagged
  group?: string;                // last category title above this row
  itemCode?: string;
  altCode?: string;
  description?: string;
  detDescription?: string;
  unit?: string;
  note?: string;
  vendorPrice?: number;
  rawPrice?: Cell;
}

export interface SheetResult {
  sheet: string;
  rows: ParsedRow[];
  counts: Record<RowKind, number>;
  warnings: string[];
}

// ---------- cell helpers ----------

/** Convert any ExcelJS cell value to text, number or null. */
export function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.replace(/\s+/g, ' ').trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return cellValue(o.result); // formula: use the stored result
    if (Array.isArray(o.richText))
      return cellValue((o.richText as { text: string }[]).map((p) => p.text).join(''));
    if ('text' in o) return cellValue(o.text); // hyperlink
  }
  return null; // errors, formulas with no stored result
}

/** Build SheetData[] from an ExcelJS workbook. Pass the loaded workbook. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function workbookToSheets(workbook: any): SheetData[] {
  const sheets: SheetData[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workbook.eachSheet((ws: any) => {
    const grid: Grid = [];
    const colCount = Math.min(ws.columnCount || 0, 60);
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const out: Cell[] = [];
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        // In a merged range only the top-left cell keeps the value
        const isMergedChild = cell.isMerged && cell.master && cell.master.address !== cell.address;
        out.push(isMergedChild ? null : cellValue(cell.value));
      }
      grid.push(out);
    }
    while (grid.length && grid[grid.length - 1].every((x) => x === null)) grid.pop();
    sheets.push({ name: ws.name, hidden: ws.state !== 'visible', grid });
  });
  return sheets;
}

export function colToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase().trim()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function indexToCol(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const CURRENCY = '(USD|AED|EUR|GBP|SAR|QAR|SGD|MYR|IDR|US\\$|S\\$|RM|\\$|€|£)';

/** Parse a price. Returns null for text such as "CALL", "Free", "TBA", "NA". */
export function toNumber(v: Cell): number | null {
  if (typeof v === 'number') return v;
  if (v === null) return null;
  let s = v.replace(/\s/g, '');
  s = s.replace(new RegExp('^' + CURRENCY, 'i'), '').replace(new RegExp(CURRENCY + '$', 'i'), '');
  if (!/^-?\d[\d.,]*$/.test(s)) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // the last separator is the decimal one
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');      // 1,234,567
    else if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');       // 12,50
    else return null;
  } else if (hasDot && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, '');                                          // 1.234.567
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const norm = (v: Cell) => (v === null ? '' : String(v).toLowerCase().replace(/\s+/g, ' ').trim());
const text = (v: Cell | undefined) => (v === null || v === undefined ? undefined : String(v));
const MISSING_CODE = /^(n\/?a|na|none|-+|–|tba|tbc|tbd)$/i;
const NOTE_LIKE = /^(note|notes|remark|remarks|disclaimer|terms|\*)/i;

// ---------- extraction ----------

/** Apply a confirmed mapping to one sheet and classify every row. */
export function extractSheet(sheet: SheetData, m: SheetMapping): SheetResult {
  const ci = colToIndex(m.itemCode);
  const pi = colToIndex(m.price);
  const idx = (c?: string | null) => (c ? colToIndex(c) : -1);
  const ai = idx(m.altCode), di = idx(m.description), ddi = idx(m.detDescription), ui = idx(m.unit), ni = idx(m.notes);

  const headerCells = sheet.grid[m.headerRow - 1] ?? [];
  const codeHeader = norm(headerCells[ci] ?? null);
  const priceHeaders = new Set<string>();
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];
  let group: string | undefined;

  sheet.grid.forEach((cells, r) => {
    const base = { sheet: sheet.name, row: r + 1 };
    const filled = cells.filter((x) => x !== null);
    if (filled.length === 0) return void rows.push({ ...base, kind: 'blank' });

    const code = cells[ci] ?? null;
    const rawPrice = cells[pi] ?? null;

    // header row, including the same header repeated above each section
    if (codeHeader !== '' && norm(code) === codeHeader) {
      if (rawPrice !== null) priceHeaders.add(String(rawPrice));
      return void rows.push({ ...base, kind: 'header', reason: 'Header row' });
    }

    const codeText = code === null ? '' : String(code).trim();
    const codeMissing = codeText === '' || MISSING_CODE.test(codeText);
    const priceNumber = toNumber(rawPrice);
    const details = {
      group,
      itemCode: codeMissing ? undefined : codeText,
      altCode: text(cells[ai]),
      description: text(cells[di]),
      detDescription: text(cells[ddi]),
      unit: text(cells[ui]),
      note: text(cells[ni]),
      rawPrice,
    };

    if (!codeMissing && priceNumber !== null && priceNumber > 0)
      return void rows.push({ ...base, kind: 'item', ...details, vendorPrice: priceNumber });

    // a single text cell on its own row is a section title (or a long note)
    if (filled.length === 1 && typeof filled[0] === 'string') {
      const title = filled[0];
      if (title.length > 80 || NOTE_LIKE.test(title)) return void rows.push({ ...base, kind: 'note', reason: 'Note', note: title });
      group = title;
      return void rows.push({ ...base, kind: 'category', reason: 'Section title', group: title });
    }

    if (!codeMissing && rawPrice !== null)
      return void rows.push({ ...base, kind: 'exception', ...details, reason: `Price is not a usable number: "${rawPrice}"` });
    if (!codeMissing && cells[di] != null)
      return void rows.push({ ...base, kind: 'exception', ...details, reason: 'Item code without a price' });
    if (codeMissing && priceNumber !== null && priceNumber > 0)
      return void rows.push({ ...base, kind: 'exception', ...details, vendorPrice: priceNumber, reason: 'Price without an item code' });

    rows.push({ ...base, kind: 'note', reason: 'No item code and no price', note: filled.map(String).join(' | ').slice(0, 200) });
  });

  // sanity warnings
  const items = rows.filter((x) => x.kind === 'item');
  const prices = items.map((x) => x.vendorPrice as number).sort((a, b) => a - b);
  if (items.length === 0) warnings.push('No items found with this mapping.');
  if (prices.length && prices[Math.floor(prices.length / 2)] < 1)
    warnings.push('The price column looks like percentages (most values are below 1).');
  if (priceHeaders.size > 1)
    warnings.push(`The price column has different headers in different sections: ${[...priceHeaders].map((h) => `"${h}"`).join(', ')}. Confirm the currency.`);

  const counts = { item: 0, category: 0, blank: 0, header: 0, note: 0, duplicate: 0, exception: 0 } as Record<RowKind, number>;
  rows.forEach((x) => counts[x.kind]++);
  return { sheet: sheet.name, rows, counts, warnings };
}

/**
 * Run after all sheets are extracted. The same code with the same price is kept once
 * (the others become 'duplicate'). The same code with different prices becomes an
 * 'exception' on every copy, so the user must choose.
 */
export function resolveDuplicates(results: SheetResult[]): SheetResult[] {
  const byCode = new Map<string, ParsedRow[]>();
  for (const res of results)
    for (const row of res.rows)
      if (row.kind === 'item' && row.itemCode) {
        const key = row.itemCode.toUpperCase();
        byCode.set(key, [...(byCode.get(key) ?? []), row]);
      }
  for (const copies of byCode.values()) {
    if (copies.length < 2) continue;
    const where = copies.map((c) => `${c.sheet} row ${c.row}`).join(', ');
    if (new Set(copies.map((c) => c.vendorPrice)).size === 1) {
      copies.slice(1).forEach((c) => { c.kind = 'duplicate'; c.reason = `Same code and price as ${copies[0].sheet} row ${copies[0].row}`; });
    } else {
      copies.forEach((c) => { c.kind = 'exception'; c.reason = `Same code with different prices (${where})`; });
    }
  }
  for (const res of results) {
    const counts = { item: 0, category: 0, blank: 0, header: 0, note: 0, duplicate: 0, exception: 0 } as Record<RowKind, number>;
    res.rows.forEach((x) => counts[x.kind]++);
    res.counts = counts;
  }
  return results;
}

// ---------- what the AI sees ----------

export interface SheetSample {
  sheet: string;
  totalRows: number;
  columns: { col: string; filled: number; numericShare: number; uniqueShare: number; medianNumber: number | null; examples: string[] }[];
  rows: { row: number; cells: Record<string, string | number> }[];
}

/** A small, fixed-size sample of one sheet. This is the ONLY pricelist data sent to the AI. */
export function buildSheetSample(sheet: SheetData, headRows = 40, spreadRows = 12, tailRows = 3): SheetSample {
  const nonEmpty: number[] = [];
  sheet.grid.forEach((cells, r) => { if (cells.some((x) => x !== null)) nonEmpty.push(r); });
  const picked = new Set<number>(nonEmpty.slice(0, headRows));
  const rest = nonEmpty.slice(headRows);
  for (let k = 0; k < spreadRows && rest.length; k++) picked.add(rest[Math.floor((k * rest.length) / spreadRows)]);
  rest.slice(-tailRows).forEach((r) => picked.add(r));

  const width = Math.max(0, ...sheet.grid.map((cells) => cells.length));
  const columns: SheetSample['columns'] = [];
  for (let c = 0; c < width; c++) {
    const values = sheet.grid.map((cells) => cells[c] ?? null).filter((x) => x !== null) as (string | number)[];
    if (!values.length) continue;
    const numbers = values.map((v) => toNumber(v)).filter((n) => n !== null) as number[];
    numbers.sort((a, b) => a - b);
    columns.push({
      col: indexToCol(c),
      filled: values.length,
      numericShare: Number((numbers.length / values.length).toFixed(2)),
      uniqueShare: Number((new Set(values.map(String)).size / values.length).toFixed(2)),
      medianNumber: numbers.length ? numbers[Math.floor(numbers.length / 2)] : null,
      examples: [...new Set(values.map((v) => String(v).slice(0, 40)))].slice(0, 4),
    });
  }

  const rows = [...picked].sort((a, b) => a - b).map((r) => {
    const cells: Record<string, string | number> = {};
    sheet.grid[r].forEach((v, c) => { if (v !== null) cells[indexToCol(c)] = typeof v === 'string' ? v.slice(0, 60) : v; });
    return { row: r + 1, cells };
  });
  return { sheet: sheet.name, totalRows: sheet.grid.length, columns, rows };
}

// ---------- checking the AI's answer ----------

/** Reject a mapping that cannot be right before the user ever sees it. */
export function validateMapping(sheet: SheetData, m: SheetMapping): { ok: boolean; problems: string[]; result: SheetResult | null } {
  const problems: string[] = [];
  const width = Math.max(0, ...sheet.grid.map((cells) => cells.length));
  const bad = (c?: string | null) => !!c && !(/^[A-Za-z]{1,2}$/.test(c) && colToIndex(c) < width);
  if (!(m.headerRow >= 1 && m.headerRow <= sheet.grid.length)) problems.push('Header row is outside the sheet.');
  if (!m.itemCode || bad(m.itemCode)) problems.push('Item code column is missing or outside the sheet.');
  if (!m.price || bad(m.price)) problems.push('Price column is missing or outside the sheet.');
  if (m.itemCode && m.price && m.itemCode.toUpperCase() === m.price.toUpperCase()) problems.push('Item code and price cannot be the same column.');
  for (const c of [m.altCode, m.description, m.detDescription, m.unit, m.notes]) if (bad(c)) problems.push(`Column ${c} is outside the sheet.`);
  if (problems.length) return { ok: false, problems, result: null };

  const result = extractSheet(sheet, m);
  const { item, exception } = result.counts;
  if (item === 0) problems.push('No items found with this mapping.');
  if (item > 0 && exception > item) problems.push('More problem rows than items: the columns are probably wrong.');
  if (result.warnings.some((w) => w.includes('percentages'))) problems.push('The price column holds percentages, not prices.');
  const codes = result.rows.filter((x) => x.kind === 'item').map((x) => x.itemCode);
  if (item >= 10 && new Set(codes).size / item < 0.5) problems.push('Item codes repeat too often: this is probably not the code column.');
  return { ok: problems.length === 0, problems, result };
}

// ---------- fallback when the AI is unavailable ----------

const CODE_HEADERS: RegExp[] = [/^(global )?sku$/, /^part ?(no\.?|number|#)$/, /^item ?(code|no\.?|number)$/, /^(product|order|article) ?(code|no\.?|number)$/, /^model( ?(no\.?|number))?$/, /^code$/];
const PRICE_HEADER = /(price|msrp|rrp|cost|\bnet\b|\blist\b)/;
const NOT_PRICE = /(margin|discount|%|term|plan)/;

/** Keyword guess of the mapping. Used when the AI call fails, and as a cross-check. */
export function guessMapping(sheet: SheetData): { mapping: SheetMapping | null; priceColumns: { col: string; header: string }[] } {
  for (let r = 0; r < Math.min(sheet.grid.length, 60); r++) {
    const labels = sheet.grid[r].map(norm);
    let code = -1;
    for (const rx of CODE_HEADERS) { code = labels.findIndex((l) => rx.test(l)); if (code >= 0) break; }
    const priceColumns = labels
      .map((l, c) => ({ col: indexToCol(c), header: String(sheet.grid[r][c] ?? ''), l }))
      .filter((x) => PRICE_HEADER.test(x.l) && !NOT_PRICE.test(x.l));
    if (code < 0 || !priceColumns.length) continue;
    const find = (rx: RegExp, not = -1) => { const i = labels.findIndex((l, c) => c !== not && rx.test(l)); return i >= 0 ? indexToCol(i) : null; };
    const name = find(/^product( name.*)?$|^name$|^item name$/);
    const desc = find(/^(description|details?|specification|long description)$/);
    return {
      mapping: {
        headerRow: r + 1,
        itemCode: indexToCol(code),
        price: priceColumns[0].col,
        description: name ?? desc,
        detDescription: name ? desc : null,
        unit: find(/^(uom|unit|units|measurement unit)$/),
      },
      priceColumns: priceColumns.map(({ col, header }) => ({ col, header })),
    };
  }
  return { mapping: null, priceColumns: [] };
}
