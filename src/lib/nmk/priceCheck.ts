// priceCheck.ts: Step 3. New cost vs ERP cost per entity, existing / new / missing, bands, top 10s,
// and description differences (gap 8). Runs in the backend function "price-check"; the result only holds
// the brand's own costs and descriptions, never rates, overheads, margins or retail.
import { codeKey, median, pctChange } from "./util";
import type { ErpItem } from "./erp";
import type { Line, TicketEntity } from "./types";

export const BANDS = [
  { label: "−10% or more", test: (p: number) => p <= -10 },
  { label: "−10 to 0%", test: (p: number) => p > -10 && p < 0 },
  { label: "0%", test: (p: number) => p === 0 },
  { label: "0 to +5%", test: (p: number) => p > 0 && p <= 5 },
  { label: "+5 to +10%", test: (p: number) => p > 5 && p <= 10 },
  { label: "+10 to +20%", test: (p: number) => p > 10 && p < 20 },
  { label: "+20% or more", test: (p: number) => p >= 20 },
];

export interface CompareRow {
  itemCode: string;
  description: string;
  oldCost: number | null;
  newCost: number | null;
  change: number | null;
  pct: number | null;
  check: boolean;
}

export interface EntityCheck {
  entityCode: string; // the ERP data used (own entity, or the region master)
  costCurrency: string; // currency of the new cost
  erpCurrency: string; // currency of the ERP cost
  currencyWarning: string | null;
  tiles: {
    compared: number;
    up: number;
    down: number;
    unchanged: number;
    noOldCost: number;
    avgPct: number | null;
    medianPct: number | null;
  };
  bands: { label: string; count: number }[];
  rows: CompareRow[];
  topUp: CompareRow[];
  topDown: CompareRow[];
}

export interface PriceCheckResult {
  masterEntity: string;
  existing: string[]; // item codes found in the master
  newCodes: { lineNo: number; itemCode: string; description: string }[];
  missing: { itemCode: string; description: string }[]; // active in the ERP, not in this list
  descriptionDiffs: { itemCode: string; erpDescription: string; vendorDescription: string }[];
  perEntity: EntityCheck[];
  warnPct: number;
}

const sameText = (a: string, b: string) =>
  a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * lines: Step 2 result. master: the brand's ERP items in the region master (001 or 012).
 * erpByEntity: brand ERP items for other ticked entities that have their own data (optional).
 */
export function runPriceCheck(input: {
  brand: string;
  lines: Line[];
  entities: TicketEntity[];
  stdCurrency: string;
  masterEntity: string;
  master: ErpItem[];
  erpByEntity?: Record<string, ErpItem[]>;
  warnPct?: number;
}): PriceCheckResult {
  const warnPct = input.warnPct ?? 10;
  const brandKey = input.brand.toUpperCase();
  const master = input.master.filter((i) => i.brand.toUpperCase() === brandKey);
  const mMap = new Map(master.map((i) => [codeKey(i.itemCode), i]));
  const inList = new Set(input.lines.map((l) => codeKey(l.itemCode)));

  const existing: string[] = [];
  const newCodes: PriceCheckResult["newCodes"] = [];
  const descriptionDiffs: PriceCheckResult["descriptionDiffs"] = [];
  for (const l of input.lines) {
    const e = mMap.get(codeKey(l.itemCode));
    if (!e) {
      newCodes.push({ lineNo: l.lineNo, itemCode: l.itemCode, description: l.description });
      continue;
    }
    existing.push(e.itemCode);
    // The vendor's own wording, even after the user picked an AI or typed description.
    const vendor = (l as { vendorDescription?: string }).vendorDescription ?? l.description;
    if (vendor && e.description && !sameText(vendor, e.description))
      descriptionDiffs.push({
        itemCode: e.itemCode,
        erpDescription: e.description,
        vendorDescription: vendor,
      });
  }
  const missing = master
    .filter((i) => i.inactive !== 1 && !inList.has(codeKey(i.itemCode)))
    .map((i) => ({ itemCode: i.itemCode, description: i.description }));

  // One comparison per distinct (ERP data, cost column): the master with the standard cost, plus any
  // own-cost entity or entity with its own ERP data.
  const perEntity: EntityCheck[] = [];
  const done = new Set<string>();
  for (const te of [
    { code: input.masterEntity, costCurrency: input.stdCurrency, ownCost: false },
    ...input.entities,
  ]) {
    const own = input.erpByEntity?.[te.code]?.filter((i) => i.brand.toUpperCase() === brandKey);
    const dataEntity = own && own.length ? te.code : input.masterEntity;
    const costKey = te.ownCost ? te.code : "std";
    const key = `${dataEntity}|${costKey}`;
    if (done.has(key)) continue;
    if (dataEntity === input.masterEntity && te.code !== input.masterEntity && !te.ownCost)
      continue; // same as the master check
    done.add(key);
    const data = dataEntity === input.masterEntity ? master : own!;
    perEntity.push(
      compareEntity(
        input.lines,
        data,
        dataEntity,
        te.ownCost ? te.costCurrency : input.stdCurrency,
        costKey,
        warnPct,
      ),
    );
  }
  return {
    masterEntity: input.masterEntity,
    existing,
    newCodes,
    missing,
    descriptionDiffs,
    perEntity,
    warnPct,
  };
}

function compareEntity(
  lines: Line[],
  data: ErpItem[],
  entityCode: string,
  costCurrency: string,
  costKey: string,
  warnPct: number,
): EntityCheck {
  const map = new Map(data.map((i) => [codeKey(i.itemCode), i]));
  const curCount = new Map<string, number>();
  for (const i of data)
    if (i.costCurrency) curCount.set(i.costCurrency, (curCount.get(i.costCurrency) ?? 0) + 1);
  const erpCurrency = [...curCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const comparable = !erpCurrency || erpCurrency === costCurrency.toUpperCase();
  const currencyWarning = comparable
    ? null
    : `The ERP cost for this brand is in ${erpCurrency}, but you picked ${costCurrency}. Old and new costs are not compared. Check the currency in Step 1.`;

  const rows: CompareRow[] = [];
  let noOldCost = 0;
  for (const l of lines) {
    const e = map.get(codeKey(l.itemCode));
    if (!e) continue;
    const newCost = costKey === "std" ? l.cost : (l.entityCosts[costKey] ?? null);
    const oldCost =
      comparable &&
      e.cost !== null &&
      (!e.costCurrency || e.costCurrency === costCurrency.toUpperCase())
        ? e.cost
        : null;
    if (oldCost === null) noOldCost++;
    const pct = pctChange(oldCost, newCost);
    const change =
      oldCost !== null && newCost !== null ? Math.round((newCost - oldCost) * 100) / 100 : null;
    rows.push({
      itemCode: e.itemCode,
      description: e.description,
      oldCost,
      newCost,
      change,
      pct,
      check: pct !== null && Math.abs(pct) > warnPct,
    });
  }
  const pcts = rows.map((r) => r.pct).filter((p): p is number => p !== null);
  const avg = pcts.length
    ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10
    : null;
  const med = median(pcts);
  const withPct = rows.filter((r) => r.pct !== null);
  return {
    entityCode,
    costCurrency,
    erpCurrency,
    currencyWarning,
    tiles: {
      compared: pcts.length,
      up: pcts.filter((p) => p > 0).length,
      down: pcts.filter((p) => p < 0).length,
      unchanged: pcts.filter((p) => p === 0).length,
      noOldCost,
      avgPct: avg,
      medianPct: med === null ? null : Math.round(med * 10) / 10,
    },
    bands: BANDS.map((b) => ({ label: b.label, count: pcts.filter(b.test).length })),
    rows,
    topUp: withPct
      .filter((r) => r.pct! > 0)
      .sort((a, b) => b.pct! - a.pct!)
      .slice(0, 10),
    topDown: withPct
      .filter((r) => r.pct! < 0)
      .sort((a, b) => a.pct! - b.pct!)
      .slice(0, 10),
  };
}
