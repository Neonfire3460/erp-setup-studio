import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRICING_TEST_CASES } from "./pricingTestCases";

export interface SelfTestLine {
  label: string;
  pass: boolean;
}

// Admin-only. Runs the spec section 8 cases through calculatePrice using the
// stored rules. Returns only a label and pass/fail per line, never rates or results.
export const runPricingSelfTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SelfTestLine[]> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { buildRows } = await import("@/server/buildRows.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { INPUT_HEADERS } = await import("./buildTypes");
    return Promise.all(PRICING_TEST_CASES.map(async (c) => {
      const label = `${c.brand} / ${c.sub} / ${c.currency} · ${c.vendorPrice} · ${c.entity}`;
      try {
        const row = Object.fromEntries(INPUT_HEADERS.map(h => [h, null])) as import("./buildTypes").InputRow;
        Object.assign(row, { "Item Code": "SELF-TEST", "Brand Activity": c.brand, "Sub Activity": c.sub, "Vendor Price": c.vendorPrice, "Local MSRP": c.localMsrp ?? null });
        const res = await buildRows(supabaseAdmin, { brand_activity: c.brand, vendor_currency: c.currency, entity_codes: [c.entity], rows: [row] });
        const columns = res.reviews[0]?.rows[0]?.columns;
        return { label, pass: columns?.["Cost Price"] === c.costPrice && columns?.["Retail Price"] === c.retailPrice };
      } catch {
        return { label, pass: false };
      }
    }));
  });
