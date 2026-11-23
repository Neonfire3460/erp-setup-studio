// crossCheck.ts: after "Mark as uploaded" and a fresh ERP import, compare every ticket row with the
// ERP data, column by column (gap 18b). All match -> the ticket can become "Verified in ERP".
import { codeKey } from "./util";
import type { ErpItem } from "./erp";
import type { ErpValues } from "./ticket";

export interface Mismatch {
  entityCode: string;
  itemCode: string;
  column: string;
  ticket: string;
  erp: string;
}
export interface CrossCheckResult {
  checkedAt: string;
  perEntity: { entityCode: string; total: number; matched: number; notInErp: number }[];
  mismatches: Mismatch[];
  allMatch: boolean;
}

// Ticket column -> ERP export field. Det. Description and B2B are not in the export.
const PAIRS: [keyof ErpValues, keyof ErpItem, "text" | "number" | "code"][] = [
  ["Supplier", "supplierCode", "code"],
  ["Alternative Code", "altCode", "text"],
  ["Description", "description", "text"],
  ["Alternate Description", "altDescription", "text"],
  ["Brand Activity", "brand", "text"],
  ["Sub Activity", "subActivity", "text"],
  ["Cost Price", "cost", "number"],
  ["Retail Price", "retail", "number"],
  ["Max Discount", "maxDiscount", "number"],
  ["Family Name", "familyCode", "code"],
  ["Group Name", "groupCode", "code"],
  ["Category Name", "categoryCode", "code"],
  ["Sub Category Name", "subCategoryCode", "code"],
  ["Midwich Family", "midwichCode", "code"],
  ["Measurement Unit", "mu", "code"],
  ["Inactive", "inactive", "number"],
  ["Webactive", "web", "number"],
];

const show = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const same = (a: unknown, b: unknown, kind: "text" | "number" | "code") => {
  if (kind === "number") {
    if ((a === null || a === "" || a === undefined) && (b === null || b === undefined)) return true;
    const x = Number(a),
      y = Number(b);
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 0.005;
  }
  const x = show(a).replace(/\s+/g, " ").trim(),
    y = show(b).replace(/\s+/g, " ").trim();
  return kind === "code" ? x.toUpperCase() === y.toUpperCase() : x === y;
};

/**
 * rows: the ticket's rows for the entities that were imported. erp: the fresh ERP items per entity.
 * Columns the export does not have (missing) are skipped, so a missing column never counts as a mismatch.
 */
export function crossCheck(
  rows: { entityCode: string; erp: ErpValues }[],
  erp: Record<string, ErpItem[]>,
  missingColumns: string[] = [],
): CrossCheckResult {
  const maps: Record<string, Map<string, ErpItem>> = {};
  for (const [e, items] of Object.entries(erp))
    maps[e] = new Map(items.map((i) => [codeKey(i.itemCode), i]));
  const skip = new Set(missingColumns.map((c) => c.toLowerCase()));
  const mismatches: Mismatch[] = [];
  const per = new Map<
    string,
    { entityCode: string; total: number; matched: number; notInErp: number }
  >();
  for (const r of rows) {
    const m = maps[r.entityCode];
    if (!m) continue; // entity not imported yet
    const p = per.get(r.entityCode) ?? {
      entityCode: r.entityCode,
      total: 0,
      matched: 0,
      notInErp: 0,
    };
    per.set(r.entityCode, p);
    p.total++;
    const code = String(r.erp["Item Code"] ?? "");
    const item = m.get(codeKey(code));
    if (!item) {
      p.notInErp++;
      mismatches.push({
        entityCode: r.entityCode,
        itemCode: code,
        column: "Item Code",
        ticket: code,
        erp: "(not in the ERP data)",
      });
      continue;
    }
    let ok = true;
    for (const [col, field, kind] of PAIRS) {
      if (skip.has(col.toLowerCase()) || skip.has(String(field).toLowerCase())) continue;
      if (!same(r.erp[col], item[field], kind)) {
        ok = false;
        mismatches.push({
          entityCode: r.entityCode,
          itemCode: code,
          column: col,
          ticket: show(r.erp[col]),
          erp: show(item[field]),
        });
      }
    }
    if (ok) p.matched++;
  }
  const perEntity = [...per.values()];
  return {
    checkedAt: new Date().toISOString(),
    perEntity,
    mismatches,
    allMatch: perEntity.length > 0 && perEntity.every((p) => p.matched === p.total),
  };
}

/** Which ERP export columns were missing -> ticket columns to skip. */
export const MISSING_TO_COLUMNS: Record<string, string[]> = {
  "Purchase price in currency": ["Cost Price"],
  Inactive: ["Inactive"],
  WEB: ["Webactive"],
  "Supplier Code": ["Supplier"],
  "Midwich Family Code": ["Midwich Family"],
  "Table 4": ["Sub Activity"],
  "Sub Activity": ["Sub Activity"],
  "% Maximum discount": ["Max Discount"],
  "Alternative code": ["Alternative Code"],
  "Alternative description": ["Alternate Description"],
  MU: ["Measurement Unit"],
  "Retail price": ["Retail Price"],
  Description: ["Description"],
};
