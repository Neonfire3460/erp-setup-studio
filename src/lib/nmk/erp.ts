// erp.ts: ERP item data. Reads an ERP export (rows from SheetJS or PapaParse, in a Web Worker),
// finds which brands it holds, skips Demo codes, checks the columns, and compares with what is stored.
// Only the brands found in the file are replaced (gap 18). Accepts both NMK export layouts seen so far:
// the 21-column one (codes and "code - name" columns) and the 53-column one ("code - name" only, WEB, Currency, Table 4).
import { cellText, codeKey, codeText, isDemoCode, parseNumber, splitCodeName } from "./util";
import type { CategoryRow } from "./categories";

export interface ErpItem {
  entityCode: string;
  itemCode: string;
  altCode: string;
  description: string;
  altDescription: string;
  mu: string;
  retail: number | null;
  cost: number | null; // "Purchase price in currency"
  costCurrency: string; // "Currency" column (gap 2)
  brand: string; // "Brand-Activity"
  subActivity: string; // "Sub Activity" or "Table 4"
  familyCode: string;
  familyName: string;
  groupCode: string;
  groupName: string;
  categoryCode: string;
  categoryName: string;
  subCategoryCode: string;
  subCategoryName: string;
  midwichCode: string;
  midwichName: string;
  inactive: 0 | 1 | null; // 0 = active in the ERP
  web: 0 | 1 | null; // WEB: Webactive, and B2B copies it (gap 3)
  maxDiscount: number | null;
  supplierCode: string;
}

/** Columns an NMK export should have. Missing ones are named before anything is saved. */
export const ERP_EXPORT_COLUMNS: {
  field: string;
  headers: string[];
  required: boolean;
  whyNeeded: string;
}[] = [
  { field: "itemCode", headers: ["Item code"], required: true, whyNeeded: "the item code" },
  {
    field: "brand",
    headers: ["Brand-Activity", "Brand Activity"],
    required: true,
    whyNeeded: "finding the brands in the file",
  },
  {
    field: "description",
    headers: ["Description"],
    required: false,
    whyNeeded: "descriptions in tickets and PDFs",
  },
  {
    field: "altCode",
    headers: ["Alternative code", "Alternate code"],
    required: false,
    whyNeeded: "Alternative Code in the ERP file",
  },
  {
    field: "altDescription",
    headers: ["Alternative description", "Alternate description"],
    required: false,
    whyNeeded: "Alternate Description in the ERP file",
  },
  {
    field: "mu",
    headers: ["MU", "Measurement Unit"],
    required: false,
    whyNeeded: "Measurement Unit",
  },
  {
    field: "retail",
    headers: ["Retail price"],
    required: false,
    whyNeeded: "current retail and PDF prices",
  },
  {
    field: "cost",
    headers: ["Purchase price in currency", "Purchase price", "Cost Price"],
    required: false,
    whyNeeded: "old cost in the Price check",
  },
  {
    field: "costCurrency",
    headers: ["Currency"],
    required: false,
    whyNeeded: "the currency of the old cost",
  },
  {
    field: "inactive",
    headers: ["Inactive"],
    required: false,
    whyNeeded: "ERP status and which items go in PDFs",
  },
  { field: "web", headers: ["WEB", "Webactive"], required: false, whyNeeded: "Webactive and B2B" },
  {
    field: "subCategory",
    headers: ["SubCategory", "Sub-category", "Sub Category"],
    required: false,
    whyNeeded: "categories",
  },
  {
    field: "midwichCode",
    headers: ["Midwich Family Code"],
    required: false,
    whyNeeded: "Midwich Family",
  },
  {
    field: "supplierCode",
    headers: ["Supplier Code"],
    required: false,
    whyNeeded: "supplier fallback",
  },
  {
    field: "subActivity",
    headers: ["Sub Activity", "Table 4"],
    required: false,
    whyNeeded: "Sub Activity",
  },
  {
    field: "maxDiscount",
    headers: ["% Maximum discount", "Max Discount"],
    required: false,
    whyNeeded: "Max Discount",
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s_]+/g, " ")
    .trim();
const flag01 = (v: unknown): 0 | 1 | null => {
  const n = parseNumber(v);
  return n === null ? null : n ? 1 : 0;
};

export interface ReadErpResult {
  ok: boolean;
  problems: string[]; // stop: nothing can be imported
  missingColumns: { header: string; whyNeeded: string }[]; // import allowed only after the admin confirms
  notes: string[];
  items: ErpItem[];
  brands: { brand: string; items: number; active: number }[];
  demoSkipped: number;
  duplicates: string[]; // repeated item codes (first row kept)
}

/**
 * rows: the sheet as arrays, header in row 1. categories: fills Family/Group/Category from the Sub Category
 * when the export has no code columns for them. currencyByBrand: fallback when there is no Currency column.
 */
export function readErpExport(
  rows: unknown[][],
  opts: {
    entityCode: string;
    categories?: Map<string, CategoryRow>;
    currencyByBrand?: Record<string, string>;
  },
): ReadErpResult {
  const res: ReadErpResult = {
    ok: false,
    problems: [],
    missingColumns: [],
    notes: [],
    items: [],
    brands: [],
    demoSkipped: 0,
    duplicates: [],
  };
  const raw = (rows[0] ?? []).map((h) => cellText(h));
  const head = raw.map(norm);
  const all = (...names: string[]) =>
    head.reduce<number[]>((acc, h, i) => (names.map(norm).includes(h) ? [...acc, i] : acc), []);
  const one = (...names: string[]) => all(...names)[0] ?? -1;

  for (const c of ERP_EXPORT_COLUMNS) {
    const found = c.field === "subCategory" ? all(...c.headers).length > 0 : one(...c.headers) >= 0;
    if (!found) {
      if (c.required)
        res.problems.push(`Missing column "${c.headers[0]}" (needed for ${c.whyNeeded}).`);
      else res.missingColumns.push({ header: c.headers[0] ?? c.field, whyNeeded: c.whyNeeded });
    }
  }
  if (res.problems.length) return res;

  // Family, Group, Category, Sub Category can each be a code column, a "code - name" column, or both.
  const sample = (i: number) => {
    let n = 0,
      d = 0;
    for (let r = 1; r < Math.min(rows.length, 3001); r++) {
      const t = cellText(rows[r]?.[i]);
      if (t && t !== "-") {
        n++;
        if (t.includes(" - ")) d++;
      }
    }
    return n ? d / n : 0;
  };
  const level = (...names: string[]) => {
    const idx = all(...names);
    const named = idx.filter((i) => sample(i) >= 0.5);
    const coded = idx.filter((i) => sample(i) < 0.5);
    return { code: coded[0] ?? -1, named: named[0] ?? -1 };
  };
  const L = {
    family: level("Family"),
    group: level("Group"),
    category: level("Category"),
    sub: level("SubCategory", "Sub-category", "Sub Category"),
  };
  if (L.category.code < 0 && L.category.named < 0)
    res.notes.push(
      "No Category column: Family, Group and Category are filled from the Categories table by Sub Category.",
    );

  const I = {
    code: one("Item code"),
    alt: one("Alternative code", "Alternate code"),
    desc: one("Description"),
    altDesc: one("Alternative description", "Alternate description"),
    mu: one("MU", "Measurement Unit"),
    retail: one("Retail price"),
    cost: one("Purchase price in currency", "Purchase price", "Cost Price"),
    cur: one("Currency"),
    brand: one("Brand-Activity", "Brand Activity"),
    sub: one("Sub Activity", "Table 4"),
    mwCode: one("Midwich Family Code"),
    mwName: one("Midwich Family"),
    inactive: one("Inactive"),
    web: one("WEB", "Webactive"),
    maxDisc: one("% Maximum discount", "Max Discount"),
    supplier: one("Supplier Code"),
  };
  if (I.sub >= 0 && norm(raw[I.sub] ?? "") !== "sub activity")
    res.notes.push(`Column "${raw[I.sub] ?? ""}" was read as Sub Activity.`);

  const pick = (lv: { code: number; named: number }, v: unknown[], width = 0) => {
    const named = lv.named >= 0 ? splitCodeName(v[lv.named]) : { code: "", name: "" };
    const code = lv.code >= 0 ? codeText(v[lv.code], width) : codeText(named.code, width);
    return { code, name: named.name };
  };

  const seen = new Set<string>();
  const brandCount = new Map<string, { items: number; active: number }>();
  let filled = 0;
  for (let r = 1; r < rows.length; r++) {
    const v = rows[r] ?? [];
    const t = (i: number) => (i < 0 ? "" : cellText(v[i]));
    const itemCode = t(I.code);
    if (!itemCode) continue;
    if (isDemoCode(itemCode)) {
      res.demoSkipped++;
      continue;
    }
    const key = codeKey(itemCode);
    if (seen.has(key)) {
      res.duplicates.push(itemCode);
      continue;
    }
    seen.add(key);
    const brand = t(I.brand);
    const fam = pick(L.family, v, 2),
      grp = pick(L.group, v),
      cat = pick(L.category, v),
      sub = pick(L.sub, v);
    const item: ErpItem = {
      entityCode: opts.entityCode,
      itemCode,
      altCode: t(I.alt),
      description: t(I.desc),
      altDescription: t(I.altDesc),
      mu: t(I.mu),
      retail: parseNumber(I.retail < 0 ? null : v[I.retail]),
      cost: parseNumber(I.cost < 0 ? null : v[I.cost]),
      costCurrency: (t(I.cur) || opts.currencyByBrand?.[brand] || "").toUpperCase(),
      brand,
      subActivity: t(I.sub),
      familyCode: fam.code,
      familyName: fam.name,
      groupCode: grp.code,
      groupName: grp.name,
      categoryCode: cat.code,
      categoryName: cat.name,
      subCategoryCode: sub.code,
      subCategoryName: sub.name,
      midwichCode: codeText(I.mwCode < 0 ? "" : v[I.mwCode], 2),
      midwichName: t(I.mwName),
      inactive: I.inactive < 0 ? null : (flag01(v[I.inactive]) ?? 0),
      web: I.web < 0 ? null : (flag01(v[I.web]) ?? 0),
      maxDiscount: parseNumber(I.maxDisc < 0 ? null : v[I.maxDisc]),
      supplierCode: t(I.supplier),
    };
    // Fill missing levels from the Categories table (keyed by Sub Category).
    const c = item.subCategoryCode
      ? opts.categories?.get(item.subCategoryCode.toUpperCase())
      : undefined;
    if (c) {
      let used = false;
      if (!item.familyCode) {
        item.familyCode = c.familyCode;
        used = true;
      }
      if (!item.familyName) item.familyName = c.familyName;
      if (!item.groupCode) {
        item.groupCode = c.groupCode;
        used = true;
      }
      if (!item.groupName) item.groupName = c.groupName;
      if (!item.categoryCode) {
        item.categoryCode = c.categoryCode;
        used = true;
      }
      if (!item.categoryName) item.categoryName = c.categoryName;
      if (!item.subCategoryName) item.subCategoryName = c.categoryName;
      if (!item.midwichCode) {
        item.midwichCode = c.midwichCode;
        used = true;
      }
      if (!item.midwichName) item.midwichName = c.midwichName;
      if (used) filled++;
    }
    res.items.push(item);
    const b = brandCount.get(brand) ?? { items: 0, active: 0 };
    b.items++;
    if (item.inactive !== 1) b.active++;
    brandCount.set(brand, b);
  }
  if (filled)
    res.notes.push(`${filled} items had category codes filled from the Categories table.`);
  if (res.demoSkipped) res.notes.push(`${res.demoSkipped} Demo codes left out.`);
  if (res.duplicates.length)
    res.notes.push(`${res.duplicates.length} rows repeat an item code (first row kept).`);
  const noCur = res.items.filter((i) => !i.costCurrency).length;
  if (noCur && I.cost >= 0)
    res.notes.push(`${noCur} items have no cost currency: the Price check cannot compare them.`);
  res.brands = [...brandCount]
    .map(([brand, c]) => ({ brand, ...c }))
    .sort((a, b) => b.items - a.items);
  if (!res.items.length) res.problems.push("No item rows found.");
  res.ok = res.problems.length === 0;
  return res;
}

/** "This file has 1 brand: Turtle AV (56 items)" */
export function brandSummary(r: ReadErpResult) {
  const n = r.brands.length;
  const list = r.brands
    .slice(0, 6)
    .map((b) => `${b.brand || "(no brand)"} (${b.items} items)`)
    .join(", ");
  return `This file has ${n} brand${n === 1 ? "" : "s"}: ${list}${n > 6 ? ` and ${n - 6} more` : ""}`;
}

const COMPARE: (keyof ErpItem)[] = [
  "altCode",
  "description",
  "altDescription",
  "mu",
  "retail",
  "cost",
  "costCurrency",
  "subActivity",
  "familyCode",
  "groupCode",
  "categoryCode",
  "subCategoryCode",
  "midwichCode",
  "inactive",
  "web",
  "maxDiscount",
  "supplierCode",
];

/** Preview before import: new, changed, and no longer in the file (only for the brands in the file). */
export function diffErp(stored: ErpItem[], incoming: ErpItem[]) {
  const brands = new Set(incoming.map((i) => i.brand.toUpperCase()));
  const old = new Map(
    stored.filter((s) => brands.has(s.brand.toUpperCase())).map((s) => [codeKey(s.itemCode), s]),
  );
  const added: string[] = [],
    changed: { itemCode: string; fields: string[] }[] = [];
  for (const n of incoming) {
    const o = old.get(codeKey(n.itemCode));
    if (!o) {
      added.push(n.itemCode);
      continue;
    }
    const fields = COMPARE.filter((f) => String(o[f] ?? "") !== String(n[f] ?? ""));
    if (fields.length) changed.push({ itemCode: n.itemCode, fields });
    old.delete(codeKey(n.itemCode));
  }
  return { added, changed, removed: [...old.values()].map((o) => o.itemCode), brands: [...brands] };
}

/** ErpItem -> erp_items row (v2 column names + v3 cost columns). import_id is added by the caller. */
export const erpItemToRow = (i: ErpItem) => ({
  entity_code: i.entityCode,
  item_code: i.itemCode,
  alternative_code: i.altCode,
  description: i.description,
  alternative_description: i.altDescription,
  measurement_unit: i.mu,
  retail_price: i.retail,
  cost_price: i.cost,
  cost_currency: i.costCurrency || null,
  brand_activity: i.brand,
  sub_activity: i.subActivity,
  family_code: i.familyCode,
  family_name: i.familyName,
  group_code: i.groupCode,
  group_name: i.groupName,
  category_code: i.categoryCode,
  category_name: i.categoryName,
  sub_category_code: i.subCategoryCode,
  sub_category_name: i.subCategoryName,
  midwich_family_code: i.midwichCode,
  midwich_family_name: i.midwichName,
  inactive: i.inactive,
  webactive: i.web,
  b2b: i.web,
  max_discount_pct: i.maxDiscount,
  supplier_code: i.supplierCode,
});

type Num = number | string | null | undefined;
const numOrNull = (v: Num) => (v === null || v === undefined || v === "" ? null : Number(v));
const flagOrNull = (v: Num): 0 | 1 | null => {
  const n = numOrNull(v);
  return n === null ? null : n ? 1 : 0;
};

/** erp_items row -> ErpItem */
export function rowToErpItem(r: {
  entity_code: string;
  item_code: string;
  alternative_code?: string | null;
  description?: string | null;
  alternative_description?: string | null;
  measurement_unit?: string | null;
  retail_price?: Num;
  cost_price?: Num;
  cost_currency?: string | null;
  brand_activity?: string | null;
  sub_activity?: string | null;
  family_code?: string | null;
  family_name?: string | null;
  group_code?: string | null;
  group_name?: string | null;
  category_code?: string | null;
  category_name?: string | null;
  sub_category_code?: string | null;
  sub_category_name?: string | null;
  midwich_family_code?: string | null;
  midwich_family_name?: string | null;
  inactive?: Num;
  webactive?: Num;
  max_discount_pct?: Num;
  supplier_code?: string | null;
}): ErpItem {
  return {
    entityCode: r.entity_code,
    itemCode: r.item_code,
    altCode: r.alternative_code ?? "",
    description: r.description ?? "",
    altDescription: r.alternative_description ?? "",
    mu: r.measurement_unit ?? "",
    retail: numOrNull(r.retail_price),
    cost: numOrNull(r.cost_price),
    costCurrency: r.cost_currency ?? "",
    brand: r.brand_activity ?? "",
    subActivity: r.sub_activity ?? "",
    familyCode: r.family_code ?? "",
    familyName: r.family_name ?? "",
    groupCode: r.group_code ?? "",
    groupName: r.group_name ?? "",
    categoryCode: r.category_code ?? "",
    categoryName: r.category_name ?? "",
    subCategoryCode: r.sub_category_code ?? "",
    subCategoryName: r.sub_category_name ?? "",
    midwichCode: r.midwich_family_code ?? "",
    midwichName: r.midwich_family_name ?? "",
    inactive: flagOrNull(r.inactive),
    web: flagOrNull(r.webactive),
    maxDiscount: numOrNull(r.max_discount_pct),
    supplierCode: r.supplier_code ?? "",
  };
}
