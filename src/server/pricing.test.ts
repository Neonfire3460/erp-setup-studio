import { describe, expect, it } from "vitest";
import { calculatePrice } from "./pricing.server";
import { PRICING_TEST_CASES } from "@/lib/pricingTestCases";

import { RULES, entitySettings } from "./pricingFixtures.test-support";

describe("pricing test cases (spec section 8)", () => {
  for (const c of PRICING_TEST_CASES) {
    it(`${c.brand}/${c.sub}/${c.currency} ${c.vendorPrice} at ${c.entity}`, () => {
      const r = RULES[`${c.brand}/${c.sub}/${c.currency}`];
      if (!r) throw new Error("Missing rule fixture");
      const ent = r.ents[c.entity];
      if (!ent) throw new Error("Missing entity fixture");
      const [exRate, overheadPct] = ent;
      const settings = entitySettings(c.brand, c.entity);
      const res = calculatePrice({ vendorPrice: settings.cost_basis === "local_msrp" ? c.localMsrp ?? 0 : c.vendorPrice, fixedRetail: settings.retail_method === "local_msrp" ? c.localMsrp ?? null : null, roundTo: settings.round_to, costMethod: r.method, discountPct: r.disc, exRate, overheadPct, marginDivisors: r.div });
      expect(res.costPrice).toBe(c.costPrice);
      expect(res.retailPrice).toBe(c.retailPrice);
    });
  }
});
