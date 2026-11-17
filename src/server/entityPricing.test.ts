import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { INPUT_HEADERS, type InputRow } from "@/lib/buildTypes";
import { PRICING_TEST_CASES } from "@/lib/pricingTestCases";
import { RULES, entitySettings } from "./pricingFixtures.test-support";
import { buildRows } from "./buildRows.server";

const suppliers: Record<string, Record<string, string>> = {
  Lightware: { "001": "SUP101045", "011": "SUP100611", "007": "SUP000160", "008": "SUP002398" },
  "Turtle AV": { "001": "SUP101021", "011": "SUP000077", "007": "SUP000377", "008": "SUP002419" },
};
function fixture(brand: string, sub: string, currency: string) {
  const rule = RULES[`${brand}/${sub}/${currency}`];
  if (!rule) throw new Error("Missing fixture");
  const entities = Object.entries(rule.ents).map(([entity_code, [ex_rate, overhead_pct]]) => ({ entity_code, ex_rate, overhead_pct, ...entitySettings(brand, entity_code) }));
  const values: Record<string, unknown> = {
    brands: { brand_activity: brand, default_unit: brand === "Turtle AV" ? "pc" : null },
    entities: entities.map(e => ({ code: e.entity_code })),
    brand_suppliers: entities.map(e => ({ entity_code: e.entity_code, supplier: suppliers[brand]?.[e.entity_code] ?? "Supplier" })),
    pricing_rules: [{ sub_activity: sub, cost_method: rule.method, discount_pct: rule.disc, margin_divisors: rule.div, max_discount_pct: ["Lightware", "Turtle AV"].includes(brand) ? 25 : null, pricing_rule_entities: entities }], erp_items: [],
  };
  const db = { from: (table: string) => {
    const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: () => Promise.resolve({ data: values[table], error: null }), then: (resolve: (v: unknown) => void) => Promise.resolve({ data: values[table], error: null }).then(resolve) }; return q;
  } } as unknown as SupabaseClient<Database>;
  return { db, entities };
}
for (const c of PRICING_TEST_CASES) {
  it(`build applies section 8 ${c.brand} ${c.entity}: cost ${c.costPrice}, retail ${c.retailPrice}`, async () => {
    const { db } = fixture(c.brand, c.sub, c.currency);
    const row = { ...Object.fromEntries(INPUT_HEADERS.map(h => [h, null])), "Item Code": "00012", "Brand Activity": c.brand, "Sub Activity": c.sub, "Vendor Price": c.vendorPrice, "Local MSRP": c.localMsrp ?? null } as InputRow;
    const res = await buildRows(db, { brand_activity: c.brand, vendor_currency: c.currency, entity_codes: [c.entity], rows: [row] });
    const output = res.reviews[0]?.rows[0];
    expect(output?.columns["Cost Price"]).toBe(c.costPrice); expect(output?.columns["Retail Price"]).toBe(c.retailPrice);
    expect(output?.checks.filter(c => c.level === "error")).toEqual([]);
    if (suppliers[c.brand]) expect(output?.columns.Supplier).toBe(suppliers[c.brand]?.[c.entity]);
    if (c.brand === "Turtle AV") { expect(output?.columns["Measurement Unit"]).toBe("pc"); expect(output?.columns["Max Discount"]).toBe(25); }
    for (const key of ["ex_rate", "overhead_pct", "margin_divisors", "discount_pct", "cost_basis", "retail_method", "round_to", "landedCost"]) expect(JSON.stringify(res.reviews)).not.toContain(key);
  });
}
for (const brand of ["Lightware", "Turtle AV", "DTEN"]) {
  for (const localMsrp of [null, 4500]) {
    it(`zero Vendor Price gives zero cost and retail for every ${brand} entity with Local MSRP ${localMsrp}`, async () => {
      const { db, entities } = fixture(brand, brand, "USD");
      const row = { ...Object.fromEntries(INPUT_HEADERS.map(h => [h, null])), "Item Code": "ZERO", "Brand Activity": brand, "Sub Activity": brand, "Vendor Price": 0, "Local MSRP": localMsrp } as InputRow;
      const res = await buildRows(db, { brand_activity: brand, vendor_currency: "USD", entity_codes: entities.map(e => e.entity_code), rows: [row] });
      expect(res.reviews).toHaveLength(entities.length);
      for (const review of res.reviews) { const output = review.rows[0]; expect(output?.columns["Cost Price"]).toBe(0); expect(output?.columns["Retail Price"]).toBe(0); expect(output?.checks.filter(c => c.level === "error")).toEqual([]); expect(output?.checks.some(c => c.level === "warning" && c.message.startsWith("Price on request"))).toBe(true); }
    });
  }
}