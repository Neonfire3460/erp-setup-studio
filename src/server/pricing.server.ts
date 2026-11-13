// pricing.ts
// Pure pricing maths. Runs ONLY inside the backend function, never in the browser,
// because exchange rates, overheads, discounts and margins are confidential.
// Tested: see the expected values in the project spec (section "Pricing test cases").

export type CostMethod = 'discount_from_msrp' | 'net_price';

export interface PricingInput {
  vendorPrice: number;      // price taken from the vendor pricelist, in vendor currency
  costMethod: CostMethod;   // discount_from_msrp: vendorPrice is the vendor MSRP
                            // net_price:          vendorPrice is already the NMK buying price
  discountPct: number;      // e.g. 35 for 35%. Ignored for net_price
  exRate: number;           // vendor currency -> entity currency. 1 when they are the same
  overheadPct: number;      // e.g. 10 for 10%
  marginDivisors: number[]; // e.g. [0.75, 0.75] means (landed / 0.75) / 0.75
}

export interface PricingResult {
  costPrice: number;        // NMK buying price, vendor currency, 2 decimals -> ERP "Cost Price"
  landedCost: number;       // entity currency, 2 decimals (kept for audit, not exported)
  retailPrice: number;      // entity currency, whole number -> ERP "Retail Price"
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Round up to a whole number, but first snap to 6 decimals so that floating point
// noise (4810.000000000001) does not push the result up by one.
export const safeRoundUp = (n: number) => Math.ceil(Number(n.toFixed(6)));

export function calculatePrice(i: PricingInput): PricingResult {
  if (!(i.vendorPrice > 0)) throw new Error('Vendor price must be greater than 0');
  if (!(i.exRate > 0)) throw new Error('Exchange rate must be greater than 0');
  if (!i.marginDivisors.length || i.marginDivisors.some((d) => !(d > 0 && d <= 1)))
    throw new Error('Margin divisors must be between 0 and 1');

  const buying =
    i.costMethod === 'discount_from_msrp'
      ? i.vendorPrice * (1 - i.discountPct / 100)
      : i.vendorPrice;
  const landed = buying * i.exRate * (1 + i.overheadPct / 100);
  const msrp = i.marginDivisors.reduce((value, d) => value / d, landed);

  return {
    costPrice: round2(buying),
    landedCost: round2(landed),
    retailPrice: safeRoundUp(msrp),
  };
}
