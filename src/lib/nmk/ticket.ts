// ticket.ts: turns a completed wizard (TicketDraft) into the 20-column ERP rows per entity, with every
// step of the retail sum saved. Also: the Step 6 missing-data check, the reviewer's "missing setup" list,
// reviewer edits with recalculation, and the column sets of the Review and Approval grids.
// BACKEND ONLY for buildTicketRows / applyEdit (they use rates and rules). checkDraft runs in both.
import {
  calcRetail,
  findFx,
  findRule,
  type Breakdown,
  type FxRate,
  type PricingRule,
} from "./pricing";
import { categoryBySub, type CategoryRow } from "./categories";
import { codeKey, isDemoCode, pctChange } from "./util";
import type { ErpItem } from "./erp";
import type { Entity, TicketDraft, TicketLine } from "./types";

export const ERP_HEADERS = [
  "Supplier",
  "Item Code",
  "Alternative Code",
  "Description",
  "Alternate Description",
  "Det. Description",
  "Brand Activity",
  "Sub Activity",
  "Cost Price",
  "Retail Price",
  "Max Discount",
  "Family Name",
  "Group Name",
  "Category Name",
  "Sub Category Name",
  "Midwich Family",
  "Measurement Unit",
  "Inactive",
  "Webactive",
  "B2B",
] as const;
export type ErpHeader = (typeof ERP_HEADERS)[number];
export type ErpValues = Record<ErpHeader, string | number | null>;

/** Text columns (codes keep leading zeros). The rest are numbers. */
export const ERP_TEXT_COLUMNS: ErpHeader[] = [
  "Supplier",
  "Item Code",
  "Alternative Code",
  "Description",
  "Alternate Description",
  "Det. Description",
  "Brand Activity",
  "Sub Activity",
  "Family Name",
  "Group Name",
  "Category Name",
  "Sub Category Name",
  "Midwich Family",
  "Measurement Unit",
];

export type RowFlag =
  | "new"
  | "supplier_changed"
  | "vendor_description"
  | "big_change"
  | "price_on_request"
  | "missing_rule"
  | "missing_fx"
  | "missing_supplier"
  | "missing_category"
  | "manual_retail"
  | "edited"
  | "no_master_data";

export interface TicketRow {
  entityCode: string;
  lineNo: number;
  itemCode: string;
  isNew: boolean;
  erp: ErpValues;
  calc: Breakdown | null; // null while the pricing rule or exchange rate is missing
  currentRetail: number | null; // this entity's ERP retail, else the latest approved retail
  retailChangePct: number | null;
  flags: RowFlag[];
  names: { family: string; group: string; category: string; midwich: string; unit: string };
}

export type MissingSetup =
  | { kind: "pricing_rule"; brand: string; entityCode: string; rows: number }
  | { kind: "fx"; from: string; to: string; rows: number }
  | { kind: "supplier"; brand: string; entityCode: string }
  | {
      kind: "new_supplier";
      brand: string;
      entityCode: string;
      name: string;
      code?: string | undefined;
    }
  | { kind: "unit"; code: string }
  | { kind: "category"; subCategoryCode: string; itemCode: string };

export const missingSetupText = (m: MissingSetup) => {
  switch (m.kind) {
    case "pricing_rule":
      return `No pricing rule for ${m.brand} in ${m.entityCode} (${m.rows} rows)`;
    case "fx":
      return `No exchange rate ${m.from} → ${m.to} (${m.rows} rows)`;
    case "supplier":
      return `No supplier code for ${m.brand} in ${m.entityCode}`;
    case "new_supplier":
      return `New supplier for ${m.brand} in ${m.entityCode}: "${m.name}"${m.code ? ` (${m.code})` : ""}. Add its code in Suppliers`;
    case "unit":
      return `Unit "${m.code}" is not in Units`;
    case "category":
      return `${m.itemCode}: Sub Category ${m.subCategoryCode} is not in Categories`;
  }
};

export interface TicketContext {
  entities: Entity[]; // all entities (name, currency, region, master)
  masterEntity: string; // region master of this ticket
  erp: Record<string, ErpItem[]>; // brand items per entity that has data (the master at least, when it has data)
  categories: Map<string, CategoryRow> | CategoryRow[];
  rules: PricingRule[];
  fx: FxRate[];
  suppliers: { brand: string; entityCode: string; supplierCode: string; supplierName: string }[];
  units: { code: string; name: string }[];
  brandDefaults: { maxDiscount: number | null; unit: string | null };
  approvedRetail?: Record<string, Record<string, number>>; // entity -> ITEMCODE -> retail of the latest approved ticket
  warnPct: number; // 10
}

/** The cost and currency a line has in an entity (standard cost unless the entity has its own cost). */
export function lineCost(draft: TicketDraft, line: TicketLine, entityCode: string) {
  const te = draft.entities.find((e) => e.code === entityCode)!;
  if (te.ownCost) return { cost: line.entityCosts[entityCode] ?? null, currency: te.costCurrency };
  return { cost: line.cost, currency: draft.stdCurrency };
}

/** Lines that go into the ticket: no Demo codes, and new codes only when the user kept them. */
export const ticketLines = (draft: TicketDraft) =>
  draft.lines.filter((l) => !isDemoCode(l.itemCode) && (!l.isNew || l.include));

export function buildTicketRows(draft: TicketDraft, ctx: TicketContext) {
  const rows: TicketRow[] = [];
  const missing = new Map<string, MissingSetup>();
  const addMissing = (k: string, m: MissingSetup) => {
    const old = missing.get(k);
    if (old && "rows" in old && "rows" in m) old.rows += m.rows;
    else if (!old) missing.set(k, m);
  };
  const ent = new Map(ctx.entities.map((e) => [e.code, e]));
  const erpMaps: Record<string, Map<string, ErpItem>> = {};
  for (const [code, items] of Object.entries(ctx.erp))
    erpMaps[code] = new Map(items.map((i) => [codeKey(i.itemCode), i]));
  const master = erpMaps[ctx.masterEntity] ?? new Map<string, ErpItem>();
  const unitName = new Map(ctx.units.map((u) => [u.code.toLowerCase(), u.name]));

  for (const te of draft.entities) {
    const e = ent.get(te.code);
    if (!e) throw new Error(`Unknown entity ${te.code}`);
    const own = erpMaps[te.code];
    const ans = draft.suppliers.find((s) => s.entityCode === te.code);
    const stored = ctx.suppliers.find(
      (s) => s.entityCode === te.code && s.brand.toUpperCase() === draft.brand.toUpperCase(),
    );
    let supplier = "";
    const supplierChanged = ans?.answer === "different";
    if (supplierChanged) {
      supplier = ans!.newCode?.trim() ?? "";
      if (!supplier)
        addMissing(`ns|${te.code}`, {
          kind: "new_supplier",
          brand: draft.brand,
          entityCode: te.code,
          name: ans!.newName ?? "",
          code: ans!.newCode,
        });
    } else {
      supplier = stored?.supplierCode || ans?.supplierCode || "";
      if (!supplier)
        addMissing(`s|${te.code}`, { kind: "supplier", brand: draft.brand, entityCode: te.code });
    }

    for (const line of ticketLines(draft)) {
      const k = codeKey(line.itemCode);
      const mine = own?.get(k);
      const m = mine ?? master.get(k);
      const isNew = line.isNew || !m;
      const flags: RowFlag[] = [];
      if (isNew) flags.push("new");
      if (supplierChanged) flags.push("supplier_changed");
      if (!isNew && line.useVendorDescription) flags.push("vendor_description");
      if (!isNew && !mine && te.code !== ctx.masterEntity) flags.push("no_master_data"); // uses master data
      const n = line.newItem;
      const cat =
        isNew && n
          ? categoryBySub(ctx.categories, n.subCategoryCode)
          : m
            ? categoryBySub(ctx.categories, m.subCategoryCode)
            : null;
      if (isNew && n && !cat) {
        flags.push("missing_category");
        addMissing(`c|${n.subCategoryCode}|${line.itemCode}`, {
          kind: "category",
          subCategoryCode: n.subCategoryCode,
          itemCode: line.itemCode,
        });
      }

      const { cost, currency } = lineCost(draft, line, te.code);
      if (cost === 0) flags.push("price_on_request");
      const subActivity = isNew ? (n?.subActivity ?? "") : m!.subActivity;
      const rule = findRule(ctx.rules, draft.brand, te.code, subActivity);
      const fx = findFx(ctx.fx, currency, e.currency);
      let calc: Breakdown | null = null;
      if (!rule) {
        flags.push("missing_rule");
        addMissing(`r|${te.code}`, {
          kind: "pricing_rule",
          brand: draft.brand,
          entityCode: te.code,
          rows: 1,
        });
      }
      if (fx === null) {
        flags.push("missing_fx");
        addMissing(`f|${currency}|${e.currency}`, {
          kind: "fx",
          from: currency,
          to: e.currency,
          rows: 1,
        });
      }
      if (rule && fx !== null && cost !== null)
        calc = calcRetail({
          cost,
          costCurrency: currency,
          sellCurrency: e.currency,
          fx,
          overheadPct: rule.overheadPct,
          marginDivisors: rule.marginDivisors,
          roundTo: rule.roundTo,
        });
      if (!supplier) flags.push("missing_supplier");

      const unitCode = isNew ? n?.unitCode || ctx.brandDefaults.unit || "" : m!.mu;
      if (isNew && unitCode && !unitName.has(unitCode.toLowerCase()))
        addMissing(`u|${unitCode}`, { kind: "unit", code: unitCode });
      const altDesc = isNew
        ? n?.altDescription || line.altDescription || line.description
        : m!.altDescription || m!.description;
      const web = isNew ? (n?.showOnWeb ? 1 : 0) : (m!.web ?? 0);
      // B2B = show prices on the website. New items: the user's answer (old drafts without it follow Website).
      const b2b = isNew ? (n?.showOnWeb ? ((n.showPrices ?? true) ? 1 : 0) : 0) : web;
      const maxDiscount = isNew
        ? (rule?.maxDiscount ?? ctx.brandDefaults.maxDiscount)
        : (m!.maxDiscount ?? rule?.maxDiscount ?? ctx.brandDefaults.maxDiscount);

      const erp: ErpValues = {
        Supplier: supplier,
        "Item Code": isNew ? line.itemCode : m!.itemCode,
        "Alternative Code": isNew
          ? n?.altCode || line.altCode || line.itemCode
          : m!.altCode || m!.itemCode,
        Description: isNew || line.useVendorDescription ? line.description : m!.description,
        "Alternate Description": altDesc,
        "Det. Description": altDesc,
        "Brand Activity": isNew ? draft.brand : m!.brand,
        "Sub Activity": subActivity,
        "Cost Price": cost,
        "Retail Price": calc ? calc.retail : null,
        "Max Discount": maxDiscount ?? null,
        "Family Name": isNew ? (cat?.familyCode ?? "") : m!.familyCode || cat?.familyCode || "",
        "Group Name": isNew ? (cat?.groupCode ?? "") : m!.groupCode || cat?.groupCode || "",
        "Category Name": isNew
          ? (cat?.categoryCode ?? "")
          : m!.categoryCode || cat?.categoryCode || "",
        "Sub Category Name": isNew ? (cat?.subCategoryCode ?? "") : m!.subCategoryCode || "",
        "Midwich Family": isNew
          ? (cat?.midwichCode ?? "")
          : m!.midwichCode || cat?.midwichCode || "",
        "Measurement Unit": unitCode,
        Inactive: isNew ? (n?.inactive ?? 0) : (m!.inactive ?? 0),
        Webactive: web,
        B2B: b2b,
      };
      // Current retail: this entity's own ERP data, else the latest approved ticket for this entity.
      const currentRetail = mine?.retail ?? ctx.approvedRetail?.[te.code]?.[k] ?? null;
      const retailChangePct = calc && calc.retail ? pctChange(currentRetail, calc.retail) : null;
      if (retailChangePct !== null && Math.abs(retailChangePct) > ctx.warnPct)
        flags.push("big_change");
      rows.push({
        entityCode: te.code,
        lineNo: line.lineNo,
        itemCode: String(erp["Item Code"]),
        isNew,
        erp,
        calc,
        currentRetail,
        retailChangePct,
        flags,
        names: {
          family: cat?.familyName ?? m?.familyName ?? "",
          group: cat?.groupName ?? m?.groupName ?? "",
          category: cat?.categoryName ?? m?.categoryName ?? "",
          midwich: cat?.midwichName ?? m?.midwichName ?? "",
          unit: unitName.get(unitCode.toLowerCase()) ?? unitCode,
        },
      });
    }
  }
  return { rows, missingSetup: [...missing.values()], counts: countRows(rows) };
}

export function countRows(rows: TicketRow[]) {
  const per: Record<
    string,
    { rows: number; new: number; existing: number; bigChange: number; missing: number }
  > = {};
  for (const r of rows) {
    const c = (per[r.entityCode] ??= { rows: 0, new: 0, existing: 0, bigChange: 0, missing: 0 });
    c.rows++;
    if (r.isNew) c.new++;
    else c.existing++;
    if (r.flags.includes("big_change")) c.bigChange++;
    if (r.flags.some((f) => f.startsWith("missing_"))) c.missing++;
  }
  return per;
}

// ---------- Step 6: everything blank blocks Submit (shared by the wizard and the backend) ----------

export interface MissingField {
  step: 2 | 4 | 5 | 1;
  lineNo?: number;
  itemCode?: string;
  field: string;
  message: string;
}

export function checkDraft(
  draft: TicketDraft,
  lists?: { units?: string[]; subActivities?: string[] },
): MissingField[] {
  const out: MissingField[] = [];
  if (!draft.brand) out.push({ step: 1, field: "brand", message: "Brand is empty" });
  if (!draft.entities.length) out.push({ step: 1, field: "entities", message: "No entity ticked" });
  for (const e of draft.entities)
    if (!e.costCurrency)
      out.push({ step: 1, field: "currency", message: `${e.code}: cost currency is empty` });
  const lines = ticketLines(draft);
  if (!lines.length) out.push({ step: 2, field: "lines", message: "There are no items" });
  for (const l of lines) {
    const at = { lineNo: l.lineNo, itemCode: l.itemCode };
    if (!l.itemCode)
      out.push({
        step: 2,
        ...at,
        field: "itemCode",
        message: `Line ${l.lineNo}: Item Code is empty`,
      });
    if (!l.description)
      out.push({
        step: 2,
        ...at,
        field: "description",
        message: `${l.itemCode}: Description is empty`,
      });
    const costs = [
      l.cost,
      ...draft.entities.filter((e) => e.ownCost).map((e) => l.entityCosts[e.code] ?? null),
    ];
    if (costs.some((c) => c === null || Number.isNaN(c)))
      out.push({
        step: 2,
        ...at,
        field: "cost",
        message: `${l.itemCode}: Cost is empty or not a number`,
      });
    else if (costs.some((c) => c === 0) && !l.priceOnRequest)
      out.push({
        step: 2,
        ...at,
        field: "cost",
        message: `${l.itemCode}: Cost is 0. Tick "Price on request" or type the cost`,
      });
    if (!l.isNew) continue;
    const n = l.newItem;
    const need: [keyof NonNullable<typeof n>, string][] = [
      ["altCode", "Alternative Code"],
      ["altDescription", "Alternative Description"],
      ["familyCode", "Family"],
      ["groupCode", "Group"],
      ["subCategoryCode", "Category"],
      ["subActivity", "Sub Activity"],
      ["unitCode", "Unit"],
    ];
    for (const [f, label] of need)
      if (!n || !String(n[f] ?? "").trim())
        out.push({ step: 4, ...at, field: f, message: `${l.itemCode}: ${label} is empty` });
    if (!n || (n.inactive !== 0 && n.inactive !== 1))
      out.push({
        step: 4,
        ...at,
        field: "inactive",
        message: `${l.itemCode}: ERP status is empty`,
      });
    if (!n || n.showOnWeb === null || n.showOnWeb === undefined)
      out.push({
        step: 4,
        ...at,
        field: "showOnWeb",
        message: `${l.itemCode}: Website (show or hide) is empty`,
      });
    else if (n.showOnWeb && (n.showPrices === null || n.showPrices === undefined))
      out.push({
        step: 4,
        ...at,
        field: "showPrices",
        message: `${l.itemCode}: B2B prices (show or hide) is empty`,
      });
    if (n?.unitCode && lists?.units && !lists.units.includes(n.unitCode))
      out.push({
        step: 4,
        ...at,
        field: "unitCode",
        message: `${l.itemCode}: Unit "${n.unitCode}" is not in the list`,
      });
    if (n?.subActivity && lists?.subActivities && !lists.subActivities.includes(n.subActivity))
      out.push({
        step: 4,
        ...at,
        field: "subActivity",
        message: `${l.itemCode}: Sub Activity "${n.subActivity}" is not in the list`,
      });
  }
  for (const e of draft.entities) {
    const s = draft.suppliers.find((x) => x.entityCode === e.code);
    if (!s || !s.answer)
      out.push({ step: 5, field: "supplier", message: `${e.code}: supplier not confirmed` });
    else if (s.answer === "different" && !s.newName?.trim())
      out.push({ step: 5, field: "supplier", message: `${e.code}: type the supplier name` });
  }
  return out;
}

// ---------- Reviewer edits (gap 11) ----------

export type EditableColumn = ErpHeader | "Exchange rate" | "Overhead %" | "Margin divisor";

/** Applies one reviewer edit. Cost, exchange rate, overhead or divisor recalculate the retail; a typed retail is manual. */
export function applyEdit(
  row: TicketRow,
  column: EditableColumn,
  value: string | number | null,
  warnPct = 10,
): TicketRow {
  const r: TicketRow = structuredClone(row);
  const num = (v: unknown) => (v === null || v === "" ? null : Number(v));
  if (!r.flags.includes("edited")) r.flags.push("edited");
  if (column === "Retail Price") {
    r.erp["Retail Price"] = num(value);
    if (r.calc) {
      r.calc.retail = num(value) ?? 0;
      r.calc.manual = true;
    }
    if (!r.flags.includes("manual_retail")) r.flags.push("manual_retail");
  } else if (
    column === "Cost Price" ||
    column === "Exchange rate" ||
    column === "Overhead %" ||
    column === "Margin divisor"
  ) {
    if (column === "Cost Price") r.erp["Cost Price"] = num(value);
    if (r.calc) {
      const c = r.calc;
      const cost = column === "Cost Price" ? (num(value) ?? 0) : c.cost;
      const fx = column === "Exchange rate" ? (num(value) ?? c.fx) : c.fx;
      const oh = column === "Overhead %" ? (num(value) ?? c.overheadPct) : c.overheadPct;
      const div =
        column === "Margin divisor"
          ? [num(value) ?? c.divisors[0] ?? 1, ...c.divisors.slice(1)]
          : c.divisors;
      r.calc = calcRetail({
        cost,
        costCurrency: c.costCurrency,
        sellCurrency: c.sellCurrency,
        fx,
        overheadPct: oh,
        marginDivisors: div,
        roundTo: c.roundTo,
      });
      r.erp["Retail Price"] = r.calc.retail;
      r.flags = r.flags.filter((f) => f !== "manual_retail");
    }
  } else {
    r.erp[column] = value;
    if (column === "Alternate Description") r.erp["Det. Description"] = value;
    if (column === "Webactive" && Number(value) === 0) r.erp["B2B"] = 0; // hidden product: no prices shown
  }
  const retail = r.erp["Retail Price"];
  r.retailChangePct =
    typeof retail === "number" && retail ? pctChange(r.currentRetail, retail) : null;
  r.flags = r.flags.filter((f) => f !== "big_change");
  if (r.retailChangePct !== null && Math.abs(r.retailChangePct) > warnPct)
    r.flags.push("big_change");
  return r;
}

// ---------- Grid columns ----------

/** Review page (A1): every ERP column, with the breakdown right after Cost Price. */
export const REVIEW_COLUMNS = [
  "Supplier",
  "Item Code",
  "Alternative Code",
  "Description",
  "Alternate Description",
  "Det. Description",
  "Brand Activity",
  "Sub Activity",
  "Cost Price",
  "Exchange rate",
  "Overhead %",
  "Landed cost",
  "Margin divisor",
  "MSRP",
  "Retail Price",
  "Current retail",
  "Retail change %",
  "Max Discount",
  "Family Name",
  "Group Name",
  "Category Name",
  "Sub Category Name",
  "Midwich Family",
  "Measurement Unit",
  "Inactive",
  "Webactive",
  "B2B",
] as const;

/** Approval page (A2): 15 columns, no categories (gap 17). */
export const APPROVAL_COLUMNS = [
  "Brand Activity",
  "Item Code",
  "Alternative Code",
  "Description",
  "Alternate Description",
  "Cost Price",
  "Exchange rate",
  "Overhead %",
  "Landed cost",
  "Margin divisor",
  "MSRP",
  "Retail Price",
  "Current retail",
  "Retail change %",
  "Measurement Unit",
] as const;

/** One flat object per row for the grids (AG Grid rowData). */
export function gridRow(r: TicketRow) {
  return {
    ...r.erp,
    "Exchange rate": r.calc?.fx ?? null,
    "Overhead %": r.calc?.overheadPct ?? null,
    "Landed cost": r.calc?.landed ?? null,
    "Margin divisor": r.calc ? r.calc.divisors.join(" ÷ ") : null,
    MSRP: r.calc?.msrp ?? null,
    "Current retail": r.currentRetail,
    "Retail change %": r.retailChangePct,
    _flags: r.flags,
    _entity: r.entityCode,
    _line: r.lineNo,
  };
}
