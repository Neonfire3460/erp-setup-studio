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

    const { calculatePrice } = await import("@/server/pricing.server");
    const { data: rules, error } = await supabase
      .from("pricing_rules")
      .select("brand_activity, sub_activity, vendor_currency, cost_method, discount_pct, margin_divisors, active, pricing_rule_entities(entity_code, ex_rate, overhead_pct)");
    if (error) throw new Error("Could not load pricing rules");

    return PRICING_TEST_CASES.map((c) => {
      const label = `${c.brand} / ${c.sub} / ${c.currency} · ${c.vendorPrice} · ${c.entity}`;
      const rule = (rules ?? []).find(
        (r) => r.active && r.brand_activity === c.brand && r.sub_activity === c.sub && r.vendor_currency === c.currency,
      );
      const ent = rule?.pricing_rule_entities.find((e) => e.entity_code === c.entity);
      if (!rule || !ent) return { label, pass: false };
      try {
        const res = calculatePrice({
          vendorPrice: c.vendorPrice,
          costMethod: rule.cost_method as "discount_from_msrp" | "net_price",
          discountPct: Number(rule.discount_pct),
          exRate: Number(ent.ex_rate),
          overheadPct: Number(ent.overhead_pct),
          marginDivisors: (rule.margin_divisors ?? []).map(Number),
        });
        return { label, pass: res.costPrice === c.costPrice && res.retailPrice === c.retailPrice };
      } catch {
        return { label, pass: false };
      }
    });
  });
