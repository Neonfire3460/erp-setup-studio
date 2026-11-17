// @ts-nocheck
// processing.ts
// Server-side only (backend function process-submission and the admin Pricing self-test).
// Turns submitted template rows into final ERP rows for each entity. Never import it in browser code:
// it reads pricing rules and exchange rates, which are confidential.
// Tested against NMK's real Lightware ERP upload (Nov 2026): 1,652 of 1,652 rows match.

import { calculatePrice } from './pricing.ts';

export interface InputRow {
  row: number;
  itemCode: string;
  alternativeCode: string;
  description: string;
  alternateDescription: string;
  brandActivity: string;
  subActivity: string;
  costPrice: number;            // already checked: a number >= 0, 2 decimals
  measurementUnit: string;
  vendorMsrp?: number | null;   // vendor list price (MSRP) in the cost currency, when Convert knows it
}

export interface SubmissionSheet {
  entityCode: string;
  costCurrency: string;         // currency the user's Cost Price is in, for this entity
  rows: InputRow[];
}

export interface EntityInfo { code: string; name: string; currency: string; sortOrder: number; }

export interface PricingRule {
  brandActivity: string;
  subActivity: string | null;   // null = every sub activity of the brand
  entityCode: string;
  method: 'calculate' | 'same_as_entity';
  sourceEntity: string | null;  // for same_as_entity: copy the retail price of this entity in the same submission
  overheadPct: number;
  marginDivisors: number[];     // e.g. [0.75, 0.75]
  roundTo: number;              // 1, 10, 100...
  maxDiscountPct: number | null;
  compareWithMsrp?: boolean;    // warn when the retail price is not equal to the vendor MSRP (same currency only)
}

export interface ErpLookup {
  measurementUnit: string;
  retailPrice: number | null;
  familyCode: string; groupCode: string; categoryCode: string; subCategoryCode: string; midwichFamilyCode: string;
  familyName: string; groupName: string; categoryName: string; subCategoryName: string; midwichFamilyName: string;
  maxDiscountPct: number | null;
  inactive: number | null; webactive: number | null; b2b: number | null;
}

export interface ProcessContext {
  brandActivity: string;
  entities: Record<string, EntityInfo>;
  rules: PricingRule[];                         // active rules of this brand
  rates: Record<string, number>;               // key `${fromCurrency}>${entityCode}`
  suppliers: Record<string, string>;            // entityCode -> supplier code for this brand
  brandDefaultUnit: string | null;
  // ERP data for this item: the same entity first; else the first entity (by sort order) that has it.
  // `sameEntity` tells whether the hit came from the same entity (only then is retailPrice the current price there).
  erp: (entityCode: string, itemCode: string) => { item: ErpLookup; sameEntity: boolean } | null;
  defaults: { inactive: number; webactive: number; b2b: number };   // for items NOT in the ERP data
  retailChangeWarnPct?: number;                 // default 20
}

export type Check = { level: 'error' | 'warning'; code: string; message: string };

export interface OutputRow {
  entityCode: string;
  row: number;
  values: Record<string, string | number | null>;   // the 20 ERP columns (excelFiles.ERP_HEADERS)
  names: { family: string; group: string; category: string; subCategory: string; midwichFamily: string } | null; // for the Catalogue
  currentErpRetail: number | null;
  checks: Check[];
}

export interface TicketNeed {
  kind: 'pricing_rule' | 'exchange_rate' | 'supplier';
  brandActivity: string;
  subActivity: string | null;
  entityCode: string;
  currency: string | null;
  rowCount: number;
  note: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function findRule(rules: PricingRule[], brand: string, sub: string, entity: string): PricingRule | null {
  const b = (brand ?? '').toLowerCase(), s = (sub ?? '').toLowerCase();
  return rules.find((r) => r.brandActivity.toLowerCase() === b && r.entityCode === entity && (r.subActivity ?? '').toLowerCase() === s)
    ?? rules.find((r) => r.brandActivity.toLowerCase() === b && r.entityCode === entity && r.subActivity === null)
    ?? null;
}

export function processSubmission(sheets: SubmissionSheet[], ctx: ProcessContext) {
  const outputs: OutputRow[] = [];
  const needs = new Map<string, TicketNeed>();
  const need = (t: Omit<TicketNeed, 'rowCount'>) => {
    const key = [t.kind, t.subActivity ?? '*', t.entityCode, t.currency ?? ''].join('|');
    const n = needs.get(key);
    if (n) n.rowCount++; else needs.set(key, { ...t, rowCount: 1 });
  };
  const warnPct = ctx.retailChangeWarnPct ?? 20;
  const inSubmission = new Set(sheets.map((s) => s.entityCode));

  // Entities that copy another entity's retail price go last.
  const ordered = [...sheets].sort((a, b) => {
    const sameA = sheetUsesCopy(a, ctx) ? 1 : 0, sameB = sheetUsesCopy(b, ctx) ? 1 : 0;
    return sameA - sameB || ctx.entities[a.entityCode].sortOrder - ctx.entities[b.entityCode].sortOrder;
  });
  const retailOf = new Map<string, number | null>();   // `${entity}|${ITEMCODE}` -> retail

  for (const sheet of ordered) {
    const ent = ctx.entities[sheet.entityCode];
    const supplier = ctx.suppliers[sheet.entityCode];
    const supplierOk = !!supplier && supplier.toUpperCase() !== 'TO SET';

    for (const r of sheet.rows) {
      const checks: Check[] = [];
      if (!supplierOk) need({ kind: 'supplier', brandActivity: ctx.brandActivity, subActivity: null, entityCode: ent.code, currency: null,
        note: `No supplier code for ${ctx.brandActivity} in ${ent.code}.` });

      // ---- retail price ----
      let retail: number | null = null;
      const rule = findRule(ctx.rules, ctx.brandActivity, r.subActivity, ent.code);
      if (!rule) {
        need({ kind: 'pricing_rule', brandActivity: ctx.brandActivity, subActivity: r.subActivity, entityCode: ent.code, currency: sheet.costCurrency,
          note: `No calculation for ${ctx.brandActivity} / ${r.subActivity} in ${ent.code}.` });
      } else if (rule.method === 'same_as_entity') {
        const src = rule.sourceEntity ?? '';
        if (!inSubmission.has(src)) {
          need({ kind: 'pricing_rule', brandActivity: ctx.brandActivity, subActivity: rule.subActivity, entityCode: ent.code, currency: sheet.costCurrency,
            note: `${ent.code} copies the retail price of ${src}, but ${src} is not in this submission. Add ${src} or choose another calculation.` });
        } else {
          const v = retailOf.get(`${src}|${r.itemCode.toUpperCase()}`);
          if (v === undefined || v === null) checks.push({ level: 'error', code: 'source_retail_missing',
            message: `No retail price for this item in ${src} to copy.` });
          else retail = v;
        }
      } else {
        const rate = sheet.costCurrency === ent.currency ? 1 : ctx.rates[`${sheet.costCurrency}>${ent.code}`];
        if (!(rate > 0)) {
          need({ kind: 'exchange_rate', brandActivity: ctx.brandActivity, subActivity: null, entityCode: ent.code, currency: sheet.costCurrency,
            note: `No exchange rate from ${sheet.costCurrency} to ${ent.code} (${ent.currency}).` });
        } else {
          retail = calculatePrice({
            vendorPrice: r.costPrice, costMethod: 'net_price', discountPct: 0, exRate: rate,
            overheadPct: rule.overheadPct, marginDivisors: rule.marginDivisors, roundTo: rule.roundTo,
          }).retailPrice;
        }
      }
      retailOf.set(`${ent.code}|${r.itemCode.toUpperCase()}`, retail);
      if (rule?.compareWithMsrp && retail !== null && r.costPrice > 0 && r.vendorMsrp && r.vendorMsrp > 0
          && sheet.costCurrency === ent.currency && retail !== r.vendorMsrp)
        checks.push({ level: 'warning', code: 'msrp_mismatch',
          message: `Retail price ${retail} is not the vendor MSRP ${r.vendorMsrp} ${ent.currency}.` });

      // ---- ERP data ----
      const hit = ctx.erp(ent.code, r.itemCode);
      const e = hit?.item ?? null;
      if (!e) checks.push({ level: 'warning', code: 'not_in_erp', message: 'New item: not in the ERP data, so the category columns are empty.' });
      const unit = r.measurementUnit || e?.measurementUnit || ctx.brandDefaultUnit || '';
      if (!unit) checks.push({ level: 'warning', code: 'unit_empty', message: 'Measurement Unit is empty.' });
      if (r.costPrice === 0) checks.push({ level: 'warning', code: 'price_on_request', message: 'Price on request: registered at 0.' });
      const current = hit?.sameEntity ? e!.retailPrice : null;
      if (retail !== null && current && current > 0) {
        const pct = ((retail - current) / current) * 100;
        if (Math.abs(pct) > warnPct) checks.push({ level: 'warning', code: 'retail_change',
          message: `Retail price changes by ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% against the ERP (${current}).` });
      }

      outputs.push({
        entityCode: ent.code,
        row: r.row,
        currentErpRetail: current ?? null,
        checks,
        names: e ? { family: e.familyName, group: e.groupName, category: e.categoryName, subCategory: e.subCategoryName, midwichFamily: e.midwichFamilyName } : null,
        values: {
          'Supplier': supplierOk ? supplier : null,
          'Item Code': r.itemCode,
          'Alternative Code': r.alternativeCode || r.itemCode,
          'Description': r.description || r.alternateDescription,
          'Alternate Description': r.alternateDescription || r.description,
          'Det. Description': r.alternateDescription || r.description,
          'Brand Activity': r.brandActivity,
          'Sub Activity': r.subActivity,
          'Cost Price': round2(r.costPrice),
          'Retail Price': retail,
          'Max Discount': rule?.maxDiscountPct ?? e?.maxDiscountPct ?? null,
          'Family Name': e?.familyCode || null,
          'Group Name': e?.groupCode || null,
          'Category Name': e?.categoryCode || null,
          'Sub Category Name': e?.subCategoryCode || null,
          'Midwich Family': e?.midwichFamilyCode || null,
          'Measurement Unit': unit || null,
          // Flags as in the ERP data (Inactive 0 = active; WEB 1 = on the website; B2B = WEB). New items: defaults.
          'Inactive': e ? (e.inactive ?? ctx.defaults.inactive) : ctx.defaults.inactive,
          'Webactive': e ? (e.webactive ?? ctx.defaults.webactive) : ctx.defaults.webactive,
          'B2B': e ? (e.b2b ?? e.webactive ?? ctx.defaults.b2b) : ctx.defaults.b2b,
        },
      });
    }
  }

  // Back to the user's order: entity sort order, then row.
  outputs.sort((a, b) => ctx.entities[a.entityCode].sortOrder - ctx.entities[b.entityCode].sortOrder || a.row - b.row);
  const tickets = [...needs.values()];
  const status: 'needs_pricing' | 'in_review' = tickets.length ? 'needs_pricing' : 'in_review';
  return { status, outputs, tickets };
}

function sheetUsesCopy(sheet: SubmissionSheet, ctx: ProcessContext) {
  return sheet.rows.some((r) => findRule(ctx.rules, ctx.brandActivity, r.subActivity, sheet.entityCode)?.method === 'same_as_entity');
}
