import { describe, expect, it } from "vitest";
import { calculatePrice } from "./pricing.server";
import { PRICING_TEST_CASES } from "@/lib/pricingTestCases";

// Seed rule values (spec section 3) for the section 8 cases.
const RULES: Record<string, { method: "discount_from_msrp" | "net_price"; disc: number; div: number[]; ents: Record<string, [number, number]> }> = {
  "Brightsign/Brightsign/USD": { method: "discount_from_msrp", disc: 35, div: [0.75, 0.75], ents: { "001": [3.675, 10], "011": [3.675, 5], "007": [3.65, 18], "008": [3.75, 11] } },
  "Ampetronic/Ampetronic/GBP": { method: "net_price", disc: 0, div: [0.5], ents: { "001": [5.1, 16] } },
  "Lightware/Lightware/AED": { method: "discount_from_msrp", disc: 40, div: [0.6], ents: { "001": [1, 10], "011": [1, 5] } },
  "Lightware/Lightware/USD": { method: "discount_from_msrp", disc: 40, div: [0.6], ents: { "007": [3.65, 18], "008": [3.75, 11] } },
  "DTEN/DTEN/USD": { method: "net_price", disc: 0, div: [0.7], ents: { "012": [1.35, 10], "013": [4.7, 10], "014": [16000, 10] } },
};

describe("pricing test cases (spec section 8)", () => {
  for (const c of PRICING_TEST_CASES) {
    it(`${c.brand}/${c.sub}/${c.currency} ${c.vendorPrice} at ${c.entity}`, () => {
      const r = RULES[`${c.brand}/${c.sub}/${c.currency}`]!;
      const [exRate, overheadPct] = r.ents[c.entity]!;
      const res = calculatePrice({ vendorPrice: c.vendorPrice, costMethod: r.method, discountPct: r.disc, exRate, overheadPct, marginDivisors: r.div });
      expect(res.costPrice).toBe(c.costPrice);
      expect(res.retailPrice).toBe(c.retailPrice);
    });
  }
});
