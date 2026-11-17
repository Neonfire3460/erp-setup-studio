// @ts-nocheck
// excelFiles.ts
// Browser-side Excel helpers for NMK Unite. Pure functions: pass in ExcelJS (or SheetJS rows) from the caller.
// Use as is. Tested against NMK's real Lightware ERP upload (Nov 2026).
//
//   buildTemplateWorkbook  -> the simple input template, one sheet per entity (Build download, Convert export)
//   readTemplateWorkbook   -> reads a filled template back (Build upload)
//   checkTemplateRows      -> fills the copy rules and returns per-row errors and warnings
//   buildErpWorkbook       -> the final ERP upload file (admin only), one sheet per entity
//   readErpData            -> reads the ERP data export (rows from SheetJS) for one entity

export const TEMPLATE_HEADERS = [
  'Item Code', 'Alternative Code', 'Description', 'Alternate Description',
  'Brand Activity', 'Sub Activity', 'Cost Price', 'Measurement Unit',
] as const;

export const ERP_HEADERS = [
  'Supplier', 'Item Code', 'Alternative Code', 'Description', 'Alternate Description', 'Det. Description',
  'Brand Activity', 'Sub Activity', 'Cost Price', 'Retail Price', 'Max Discount',
  'Family Name', 'Group Name', 'Category Name', 'Sub Category Name', 'Midwich Family',
  'Measurement Unit', 'Inactive', 'Webactive', 'B2B',
] as const;

// Headers of the ERP data export (for example "NMK 001 Data.xlsx"). Matched by name, not position.
// Group, Family and Category each appear twice: once as a code ("0206") and once as "code - name"
// ("0206 - Controllers"); readErpData tells them apart by their values.
export const ERP_DATA_REQUIRED = [
  'Item code', 'Description', 'Brand-Activity', 'Group', 'Family', 'Category', 'Sub-category', 'SubCategory',
  'Midwich Family', 'Midwich Family Code', 'Sub Activity',
] as const;

export type CheckLevel = 'error' | 'warning';
export interface Check { level: CheckLevel; code: string; message: string; }

export interface TemplateRow {
  row: number;                 // Excel row number in its sheet
  itemCode: string;
  alternativeCode: string;
  description: string;
  alternateDescription: string;
  brandActivity: string;
  subActivity: string;
  costPrice: number | null;    // null when empty or not a number
  costRaw: string;             // the cell as typed, for messages
  measurementUnit: string;
}

export interface TemplateSheetSpec {
  entityCode: string;
  entityName: string;          // e.g. "NMK 001"
  costCurrency: string;        // currency of the Cost Price column for this entity, e.g. "AED"
  rows?: Partial<TemplateRow>[];
}

export interface TemplateSheet {
  sheetName: string;
  entityCode: string;
  costCurrency: string;
  rows: TemplateRow[];
}

export interface ReadTemplateResult {
  ok: boolean;
  problems: string[];          // file-level problems: stop and show them
  brandActivity: string | null;
  sheets: TemplateSheet[];     // sheets without any rows are left out
}

export const templateSheetName = (entityName: string, currency: string) =>
  `${entityName} (${currency})`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

const META = '_meta';
const LISTS = 'Lists';

// ---------- cell helpers ----------

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as any;
  if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text).join('').trim();
  if ('result' in o) return cellText(o.result);       // formula
  if ('text' in o) return cellText(o.text);           // hyperlink
  if ('error' in o) return '';
  return String(v).trim();
}

export function parseCost(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const o = v as any;
  if (o && typeof o === 'object' && 'result' in o) return parseCost(o.result);
  let s = cellText(v).replace(/\s/g, '');
  if (!s) return null;
  s = s.replace(/^(AED|USD|EUR|SAR|QAR|GBP|SGD|MYR|IDR|\$|€|£)/i, '').replace(/(AED|USD|EUR|SAR|QAR|GBP|SGD|MYR|IDR)$/i, '');
  if (/^-?[\d,]*\.?\d+$/.test(s)) s = s.replace(/,/g, '');            // 1,200.50
  else if (/^-?[\d.]*,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.200,50
  const n = Number(s);
  return s !== '' && Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------- template: write ----------

export function buildTemplateWorkbook(
  ExcelJS: any,
  opts: { brandActivity: string; subActivities: string[]; sheets: TemplateSheetSpec[]; createdAt?: string },
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NMK Unite';

  for (const s of opts.sheets) {
    const name = templateSheetName(s.entityName, s.costCurrency);
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { width: 18, style: { numFmt: '@' } }, { width: 24 }, { width: 50 }, { width: 50 },
      { width: 18 }, { width: 20 }, { width: 14, style: { numFmt: '0.00' } }, { width: 18 },
    ];
    const head = ws.getRow(1);
    TEMPLATE_HEADERS.forEach((h, i) => { head.getCell(i + 1).value = h; });
    head.font = { bold: true };
    head.eachCell((c: any) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEFFF' } }; });
    head.getCell(7).note = `Cost Price in ${s.costCurrency} for ${s.entityName}`;

    for (const r of s.rows ?? []) {
      const row = ws.addRow([
        r.itemCode || null, r.alternativeCode || null, r.description || null, r.alternateDescription || null,
        r.brandActivity || opts.brandActivity, r.subActivity || null,
        r.costPrice ?? null, r.measurementUnit || null,
      ]);
      row.getCell(1).numFmt = '@';
      if (!r.subActivity) row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } };
    }
    const last = Math.max(ws.rowCount + 500, 1000);
    ws.dataValidations.add(`E2:E${last}`, { type: 'list', allowBlank: true, formulae: [`${LISTS}!$A$1`] });
    if (opts.subActivities.length) {
      ws.dataValidations.add(`F2:F${last}`, {
        type: 'list', allowBlank: true, formulae: [`${LISTS}!$B$1:$B$${opts.subActivities.length}`],
        showErrorMessage: true, errorTitle: 'Sub Activity', error: 'Pick a Sub Activity from the list.',
      });
    }
  }

  const lists = wb.addWorksheet(LISTS);
  lists.state = 'hidden';
  lists.getCell('A1').value = opts.brandActivity;
  opts.subActivities.forEach((s, i) => { lists.getCell(`B${i + 1}`).value = s; });

  const meta = wb.addWorksheet(META);
  meta.state = 'veryHidden';
  meta.addRow(['template_version', 2]);
  meta.addRow(['brand_activity', opts.brandActivity]);
  meta.addRow(['created_at', opts.createdAt ?? new Date().toISOString()]);
  meta.addRow([]);
  meta.addRow(['sheet', 'entity_code', 'currency']);
  for (const s of opts.sheets) meta.addRow([templateSheetName(s.entityName, s.costCurrency), s.entityCode, s.costCurrency]);
  return wb;
}

// ---------- template: read ----------

export function readTemplateWorkbook(
  wb: any,
  opts: { entities: { code: string; name: string }[]; currencies: string[]; defaultCurrency?: string | null },
): ReadTemplateResult {
  const problems: string[] = [];
  const sheets: TemplateSheet[] = [];
  const known = new Set(opts.entities.map((e) => e.code));
  const meta = wb.getWorksheet(META);
  let brandActivity: string | null = null;
  const plan: { sheetName: string; entityCode: string; costCurrency: string }[] = [];

  if (meta) {
    brandActivity = cellText(meta.getCell('B2').value) || null;
    for (let r = 6; r <= meta.rowCount; r++) {
      const sheetName = cellText(meta.getCell(`A${r}`).value);
      const entityCode = cellText(meta.getCell(`B${r}`).value).padStart(3, '0');
      const costCurrency = cellText(meta.getCell(`C${r}`).value).toUpperCase();
      if (sheetName) plan.push({ sheetName, entityCode, costCurrency });
    }
  } else {
    // No _meta (file rebuilt by hand): work out entity and currency from each sheet name, e.g. "NMK 001 (AED)".
    wb.eachSheet((ws: any) => {
      if (ws.state !== 'visible' || ws.name === LISTS) return;
      const codes = (ws.name.match(/\d{3}/g) ?? []).filter((c: string) => known.has(c));
      const byName = opts.entities.find((e) => ws.name.toLowerCase().includes(e.name.toLowerCase()));
      const entityCode = codes[0] ?? byName?.code ?? '';
      const cur = (ws.name.match(/\(([A-Za-z]{3})\)/)?.[1] ?? opts.defaultCurrency ?? '').toUpperCase();
      if (!entityCode) { problems.push(`Sheet "${ws.name}": cannot tell which entity it is for. Put the entity code (for example 001) in the sheet name.`); return; }
      plan.push({ sheetName: ws.name, entityCode, costCurrency: cur });
    });
  }

  const seen = new Set<string>();
  for (const p of plan) {
    const ws = wb.getWorksheet(p.sheetName);
    if (!ws) { problems.push(`Sheet "${p.sheetName}" is missing. Do not rename or delete the sheets of the template.`); continue; }
    if (!known.has(p.entityCode)) { problems.push(`Sheet "${p.sheetName}": unknown entity ${p.entityCode}.`); continue; }
    if (seen.has(p.entityCode)) { problems.push(`Entity ${p.entityCode} appears on more than one sheet.`); continue; }
    if (!opts.currencies.includes(p.costCurrency)) { problems.push(`Sheet "${p.sheetName}": currency "${p.costCurrency}" is not in the currency list.`); continue; }
    seen.add(p.entityCode);

    const head = TEMPLATE_HEADERS.map((_, i) => cellText(ws.getRow(1).getCell(i + 1).value));
    const bad = TEMPLATE_HEADERS.filter((h, i) => head[i].toLowerCase() !== h.toLowerCase());
    if (bad.length) {
      problems.push(`Sheet "${p.sheetName}": row 1 must have the headers ${TEMPLATE_HEADERS.join(', ')}. Missing or renamed: ${bad.join(', ')}.`);
      continue;
    }

    const rows: TemplateRow[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const c = (i: number) => ws.getRow(r).getCell(i).value;
      const vals = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cellText(c(i)));
      if (vals.every((v) => v === '')) continue;               // blank row
      rows.push({
        row: r,
        itemCode: vals[0],
        alternativeCode: vals[1],
        description: vals[2],
        alternateDescription: vals[3],
        brandActivity: vals[4],
        subActivity: vals[5],
        costPrice: parseCost(c(7)),
        costRaw: vals[6],
        measurementUnit: vals[7],
      });
    }
    if (rows.length) sheets.push({ sheetName: p.sheetName, entityCode: p.entityCode, costCurrency: p.costCurrency, rows });
  }
  if (!sheets.length && !problems.length) problems.push('The file has no item rows.');
  return { ok: problems.length === 0, problems, brandActivity, sheets };
}

// ---------- template: row checks (browser, before submitting) ----------

export const DESCRIPTION_MAX = 255;
export const ALT_DESCRIPTION_MAX = 500;

export function checkTemplateRows(
  rows: TemplateRow[],
  opts: { brandActivity: string; subActivities: string[] },
): { rows: TemplateRow[]; checks: Map<number, Check[]> } {
  const out: TemplateRow[] = [];
  const checks = new Map<number, Check[]>();
  const add = (row: number, level: CheckLevel, code: string, message: string) => {
    const list = checks.get(row) ?? [];
    list.push({ level, code, message });
    checks.set(row, list);
  };
  const subs = new Map(opts.subActivities.map((s) => [s.toLowerCase(), s]));
  const codes = new Map<string, number>();

  for (const src of rows) {
    const r = { ...src };
    // Copy rules: one code -> both code columns; one description -> both description columns.
    if (!r.alternativeCode) r.alternativeCode = r.itemCode;
    if (!r.description && r.alternateDescription) r.description = r.alternateDescription;
    if (!r.alternateDescription) r.alternateDescription = r.description;
    if (!r.brandActivity) r.brandActivity = opts.brandActivity;
    const sub = subs.get(r.subActivity.toLowerCase());
    if (sub) r.subActivity = sub;                           // normalise case

    if (!r.itemCode) add(r.row, 'error', 'code_empty', 'Item Code is empty.');
    else {
      const key = r.itemCode.toUpperCase();
      if (codes.has(key)) add(r.row, 'error', 'code_duplicate', `Item Code ${r.itemCode} is also on row ${codes.get(key)}.`);
      else codes.set(key, r.row);
    }
    if (!r.description) add(r.row, 'error', 'description_empty', 'Description is empty.');
    if (r.brandActivity.toLowerCase() !== opts.brandActivity.toLowerCase())
      add(r.row, 'error', 'brand_mismatch', `Brand Activity "${r.brandActivity}" is not ${opts.brandActivity}.`);
    if (!r.subActivity) add(r.row, 'error', 'sub_empty', 'Sub Activity is empty.');
    else if (!sub) add(r.row, 'error', 'sub_unknown', `Sub Activity "${r.subActivity}" is not in the list for ${opts.brandActivity}.`);
    if (r.costPrice === null) add(r.row, 'error', 'cost_invalid', r.costRaw ? `Cost Price "${r.costRaw}" is not a number.` : 'Cost Price is empty.');
    else if (r.costPrice < 0) add(r.row, 'error', 'cost_negative', 'Cost Price is below 0.');
    else if (r.costPrice === 0) add(r.row, 'warning', 'price_on_request', 'Cost Price is 0: price on request, registered at 0.');
    if (r.description.length > DESCRIPTION_MAX)
      add(r.row, 'warning', 'description_long', `Description has ${r.description.length} characters; the ERP keeps the first ${DESCRIPTION_MAX}.`);
    if (r.alternateDescription.length > ALT_DESCRIPTION_MAX)
      add(r.row, 'warning', 'alt_description_long', `Alternate Description has ${r.alternateDescription.length} characters; the ERP keeps the first ${ALT_DESCRIPTION_MAX}.`);
    if (r.costPrice !== null) r.costPrice = round2(r.costPrice);
    out.push(r);
  }
  return { rows: out, checks };
}

// ---------- final ERP file (admin only) ----------

export type ErpRow = Record<(typeof ERP_HEADERS)[number], string | number | null>;

const ERP_TEXT = new Set(['Item Code', 'Family Name', 'Group Name', 'Category Name', 'Sub Category Name', 'Midwich Family']);
const ERP_NUMBER = new Set(['Cost Price', 'Retail Price', 'Max Discount', 'Inactive', 'Webactive', 'B2B']);

export function buildErpWorkbook(ExcelJS: any, sheets: { name: string; rows: ErpRow[] }[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NMK Unite';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.addRow([...ERP_HEADERS]);
    ws.getRow(1).font = { bold: true };
    for (const r of s.rows) {
      const row = ws.addRow(ERP_HEADERS.map((h) => {
        const v = r[h];
        if (v === null || v === undefined || v === '') return null;
        if (ERP_NUMBER.has(h)) return typeof v === 'number' ? v : Number(v);
        return String(v);
      }));
      ERP_HEADERS.forEach((h, i) => { if (ERP_TEXT.has(h)) row.getCell(i + 1).numFmt = '@'; });
    }
    ws.columns.forEach((c: any, i: number) => { c.width = [12, 16, 22, 50, 50, 50][i] ?? 14; });
  }
  return wb;
}

// ---------- ERP data export (admin import) ----------

export interface ErpItem {
  entityCode: string;
  itemCode: string;            // trimmed, as in the ERP
  alternativeCode: string;
  description: string;
  alternativeDescription: string;
  measurementUnit: string;
  retailPrice: number | null;
  brandActivity: string;
  subActivity: string;
  familyCode: string;          // -> ERP file "Family Name"        e.g. "02"
  groupCode: string;           // -> ERP file "Group Name"         e.g. "0206"
  categoryCode: string;        // -> ERP file "Category Name"      e.g. "020602"
  subCategoryCode: string;     // -> ERP file "Sub Category Name"  e.g. "L30130"
  midwichFamilyCode: string;   // -> ERP file "Midwich Family"     e.g. "06"
  familyName: string;          // -> Catalogue page                e.g. "02 - Video"
  groupName: string;           //                                  e.g. "0206 - Controllers"
  categoryName: string;        //                                  e.g. "020602 - Video Switchers"
  subCategoryName: string;     //                                  e.g. "L30130 - Video Switchers"
  midwichFamilyName: string;   //                                  e.g. "Other Accessories"
  maxDiscountPct: number | null;
  supplierCode: string;
  inactive: number | null;     // "Inactive": 0 = active in the ERP, 1 = inactive
  webactive: number | null;    // "WEB" (or "Webactive"): 1 = on the website
  b2b: number | null;          // "B2B" when the export has it, else the same as WEB
}

// rows: array of arrays, row 0 = headers (SheetJS: sheet_to_json(ws, { header: 1, raw: true, defval: null }),
// or PapaParse rows for a CSV). Do NOT use ExcelJS for this file: it has up to 200,000+ rows.
export function readErpData(rows: unknown[][], entityCode: string) {
  const problems: string[] = [];
  const empty = { ok: false, problems, items: [] as ErpItem[], subActivities: [] as [string, string][], suppliers: [] as [string, string][] };
  const head = (rows[0] ?? []).map((h) => cellText(h).toLowerCase());
  const all = (name: string) => head.reduce<number[]>((acc, h, i) => (h === name.toLowerCase() ? [...acc, i] : acc), []);
  const one = (...names: string[]) => { for (const n of names) { const i = head.indexOf(n.toLowerCase()); if (i >= 0) return i; } return -1; };

  // Sub Activity is the last column; some exports call it "Table 4".
  let iSub = one('Sub Activity');
  if (iSub < 0 && /^table \d+$/.test(head[head.length - 1] ?? '')) {
    iSub = head.length - 1;
    problems.push(`Column "${cellText(rows[0][iSub])}" was read as Sub Activity. Rename it to "Sub Activity" in the next export.`);
  }
  const missing = ERP_DATA_REQUIRED.filter((h) => (h === 'Sub Activity' ? iSub < 0 : one(h) < 0));
  // Two columns each of Group, Family, Category: one code, one "code - name".
  const pair = (name: string): [number, number] | null => {
    const idx = all(name);
    if (idx.length < 2) return null;
    const dash = (i: number) => {
      let n = 0, d = 0;
      for (let r = 1; r < Math.min(rows.length, 2001); r++) {
        const t = cellText(rows[r]?.[i]);
        if (t) { n++; if (t.includes(' - ')) d++; }
      }
      return n ? d / n : 0;
    };
    const [a, b] = idx;
    return dash(a) >= dash(b) ? [b, a] : [a, b];          // [code, name]
  };
  const pg = pair('Group'), pf = pair('Family'), pc = pair('Category');
  for (const [n, p] of [['Group', pg], ['Family', pf], ['Category', pc]] as const)
    if (!p && !missing.includes(n as any)) missing.push(n as any);
  if (missing.length) {
    problems.push(`Missing columns: ${missing.join(', ')}. Group, Family and Category must each appear twice (code, and "code - name").`);
    return empty;
  }

  const I = {
    code: one('Item code'), alt: one('Alternative code'), desc: one('Description'), altDesc: one('Alternative description'),
    mu: one('MU'), retail: one('Retail price'), brand: one('Brand-Activity'), sub: iSub,
    subCatCode: one('Sub-category'), subCatName: one('SubCategory'),
    mwName: one('Midwich Family'), mwCode: one('Midwich Family Code'),
    maxDisc: one('% Maximum discount'), supplier: one('Supplier Code'),
    inactive: one('Inactive'), web: one('WEB', 'Webactive'), b2b: one('B2B'),
  };
  const flag = (i: number, v: unknown[]) => { if (i < 0) return null; const n = parseCost(v[i]); return n === null ? null : n ? 1 : 0; };

  const items: ErpItem[] = [];
  const seen = new Set<string>();
  const subs = new Map<string, [string, string]>();
  const supCount = new Map<string, Map<string, number>>();
  let dup = 0;
  for (let r = 1; r < rows.length; r++) {
    const v = rows[r] ?? [];
    const t = (i: number) => (i < 0 ? '' : cellText(v[i]));
    const itemCode = t(I.code);
    if (!itemCode) continue;
    const key = itemCode.toUpperCase();
    if (seen.has(key)) { dup++; continue; }
    seen.add(key);
    const web = flag(I.web, v);
    const item: ErpItem = {
      entityCode, itemCode,
      alternativeCode: t(I.alt), description: t(I.desc), alternativeDescription: t(I.altDesc),
      measurementUnit: t(I.mu), retailPrice: I.retail < 0 ? null : parseCost(v[I.retail]),
      brandActivity: t(I.brand), subActivity: t(I.sub),
      familyCode: t(pf![0]), groupCode: t(pg![0]), categoryCode: t(pc![0]), subCategoryCode: t(I.subCatCode), midwichFamilyCode: t(I.mwCode),
      familyName: t(pf![1]), groupName: t(pg![1]), categoryName: t(pc![1]), subCategoryName: t(I.subCatName), midwichFamilyName: t(I.mwName),
      maxDiscountPct: I.maxDisc < 0 ? null : parseCost(v[I.maxDisc]),
      supplierCode: t(I.supplier),
      inactive: flag(I.inactive, v),
      webactive: web,
      b2b: I.b2b >= 0 ? flag(I.b2b, v) : web,               // B2B follows WEB
    };
    items.push(item);
    // Brands, sub activities and suppliers come from ACTIVE items only.
    if (item.inactive === 1) continue;
    if (item.brandActivity && item.subActivity) subs.set(`${item.brandActivity}|${item.subActivity}`.toLowerCase(), [item.brandActivity, item.subActivity]);
    if (item.brandActivity && item.supplierCode) {
      const m = supCount.get(item.brandActivity) ?? new Map<string, number>();
      m.set(item.supplierCode, (m.get(item.supplierCode) ?? 0) + 1);
      supCount.set(item.brandActivity, m);
    }
  }
  if (dup) problems.push(`${dup} rows repeat an item code already in the file; the first one was kept.`);
  // The most used supplier code per brand (active items), to pre-fill brand_suppliers for this entity.
  const suppliers: [string, string][] = [...supCount].map(([b, m]) => [b, [...m].sort((a, c) => c[1] - a[1])[0][0]]);
  return { ok: true, problems, items, subActivities: [...subs.values()], suppliers };
}
