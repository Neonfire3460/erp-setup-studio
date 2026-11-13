import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildRows } from "./buildRows.server";
import { INPUT_HEADERS, inputChecks, type InputRow } from "@/lib/buildTypes";

function row(changes: Partial<InputRow> = {}): InputRow {
  return { ...Object.fromEntries(INPUT_HEADERS.map(h => [h, null])), "Item Code": "00012", "Brand Activity": "Brightsign", "Sub Activity": "Brightsign", "Vendor Price": 1000, Description: "Player", ...changes } as InputRow;
}
function db(master: Record<string, unknown>[] = [], supplier = "Supplier", defaultUnit: string | null = "EA") {
  const values: Record<string, unknown> = {
    brands: { brand_activity: "Brightsign", supplier, default_unit: defaultUnit },
    entities: [{ code: "008" }], erp_items: master,
    pricing_rules: [{ id: "rule", active: true, sub_activity: "Brightsign", cost_method: "discount_from_msrp", discount_pct: 35, margin_divisors: [0.75, 0.75], max_discount_pct: 25, pricing_rule_entities: [{ entity_code: "008", ex_rate: 3.75, overhead_pct: 11 }] }],
  };
  return { from: (table: string) => {
    const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: () => Promise.resolve({ data: values[table], error: null }), then: (resolve: (v: unknown) => void) => Promise.resolve({ data: values[table], error: null }).then(resolve) }; return q;
  } } as unknown as SupabaseClient<Database>;
}
const input = (rows: InputRow[]) => ({ brand_activity: "Brightsign", vendor_currency: "USD", entity_codes: ["008"], rows });
describe("Tool 2 checks", () => {
  const checks = (r: InputRow, rows = [r], known = true, active = true, supplier = "Supplier") => inputChecks(r, rows, "Brightsign", known, active, supplier);
  it("rejects empty Item Code", () => expect(checks(row({ "Item Code": "" }))).toContainEqual({ level: "error", message: "Item Code empty" }));
  it("rejects duplicate trimmed upper-case codes", () => expect(checks(row(), [row(), row({ "Item Code": " 00012 " })]).some(c => c.message.includes("twice"))).toBe(true));
  it("requires Vendor Price greater than zero", () => { expect(checks(row({ "Vendor Price": 0 })).some(c => c.message.includes("greater than 0"))).toBe(true); expect(checks(row({ "Vendor Price": 1 }))).toEqual([]); });
  it("rejects multiple brands", () => expect(checks(row(), [row(), row({ "Brand Activity": "Other" })]).some(c => c.message.includes("More than one"))).toBe(true));
  it("rejects unknown brands", () => expect(checks(row(), [row()], false).some(c => c.message.includes("Unknown"))).toBe(true));
  it("requires Sub Activity", () => expect(checks(row({ "Sub Activity": "" })).some(c => c.message === "Sub Activity empty")).toBe(true));
  it("requires an active rule for currency and entity", () => expect(checks(row(), [row()], true, false).some(c => c.message.includes("No active"))).toBe(true));
  it("accepts Max Discount only from 0 through 100", () => { for (const max of [-1,101,"bad"]) expect(checks(row({ "Max Discount": max })).some(c => c.message.includes("between 0 and 100"))).toBe(true); for (const max of [0,100,null]) expect(checks(row({ "Max Discount": max }))).toEqual([]); });
  it("rejects missing or TO SET suppliers", () => { for (const supplier of ["", "TO SET"]) expect(checks(row(), [row()], true, true, supplier).some(c => c.message.includes("supplier"))).toBe(true); });
});
describe("ERP output", () => {
  it("uses calculatePrice and preserves leading zeros with the 008 rounding case", async () => {
    const { reviews } = await buildRows(db(), input([row()]));
    const result = reviews[0]?.rows[0];
    expect(result?.columns["Item Code"]).toBe("00012"); expect(result?.columns["Cost Price"]).toBe(650); expect(result?.columns["Retail Price"]).toBe(4810);
    expect(Object.keys(result?.columns ?? {})).toHaveLength(20);
    for (const secret of ["discount_pct", "ex_rate", "overhead_pct", "margin_divisors", "landedCost"]) expect(JSON.stringify(reviews)).not.toContain(secret);
  });
  it("falls back Max Discount from input to rule to blank", async () => {
    const a = await buildRows(db(), input([row({ "Max Discount": 0 })])); expect(a.reviews[0]?.rows[0]?.columns["Max Discount"]).toBe(0);
    const b = await buildRows(db(), input([row()])); expect(b.reviews[0]?.rows[0]?.columns["Max Discount"]).toBe(25);
    const c = await buildRows(db(), input([row({ "Sub Activity": "None" })])); expect(c.reviews[0]?.rows[0]?.columns["Max Discount"]).toBe("");
  });
  it("uses input, ERP, then brand unit", async () => {
    const master = [{ item_code: "00012", measurement_unit: "ERP", family_name: "Family" }];
    const a = await buildRows(db(master), input([row({ "Measurement Unit": "INPUT" })])); expect(a.reviews[0]?.rows[0]?.columns["Measurement Unit"]).toBe("INPUT");
    const b = await buildRows(db(master), input([row()])); expect(b.reviews[0]?.rows[0]?.columns["Measurement Unit"]).toBe("ERP"); expect(b.reviews[0]?.rows[0]?.columns["Family Name"]).toBe("Family");
    const c = await buildRows(db(), input([row()])); expect(c.reviews[0]?.rows[0]?.columns["Measurement Unit"]).toBe("EA");
  });
  it("warns for unknown ERP item, empty unit and empty description", async () => {
    const res = await buildRows(db([], "Supplier", null), input([row({ Description: "" })])); expect(res.reviews[0]?.rows[0]?.checks.filter(c => c.level === "warning")).toHaveLength(3); expect(res.reviews[0]?.rows[0]?.columns["Family Name"]).toBe("");
  });
});