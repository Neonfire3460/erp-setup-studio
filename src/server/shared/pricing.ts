// pricing.ts
// Pure pricing maths. Runs ONLY inside the backend function, never in the browser,
// because exchange rates, overheads, discounts and margins are confidential.
// Verified against NMK's real Lightware and Turtle AV ERP upload files (Nov 2026).

export type CostMethod = 'discount_from_msrp' | 'net_price';

export interface PricingInput {
  vendorPrice: number;      // the price this entity is costed from, in its currency
                            // (the row's Vendor Price, or its Local MSRP when the entity's cost basis is local_msrp)
  costMethod: CostMethod;   // discount_from_msrp: vendorPrice is an MSRP; net_price: it is already the NMK buying price
  discountPct: number;      // e.g. 40 for 40%. Ignored for net_price
  exRate: number;           // cost currency -> entity currency. 1 when they are the same
  overheadPct: number;      // e.g. 11 for 11%
  marginDivisors: number[]; // e.g. [0.75, 0.75] means (landed / 0.75) / 0.75
  roundTo?: number;         // round the retail price UP to a multiple of this. 1 (default), 10 or 100
  fixedRetail?: number | null; // entity uses the vendor's local MSRP as its retail price: no calculation
}

export interface PricingResult {
  costPrice: number;        // NMK buying price, in the currency it was costed from, 2 decimals -> ERP "Cost Price"
  landedCost: number;       // entity currency, 2 decimals (kept for audit, not exported)
  retailPrice: number;      // entity currency -> ERP "Retail Price"
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Round up to a multiple of `step`, after snapping to 6 decimals so that floating point
// noise (4810.000000000001) does not push the result up by one step.
export const safeRoundUp = (n: number, step = 1) => Math.ceil(Number((n / step).toFixed(6))) * step;

export function calculatePrice(i: PricingInput): PricingResult {
  if (!(i.vendorPrice >= 0)) throw new Error('Vendor price must be 0 or more');
  if (!(i.exRate > 0)) throw new Error('Exchange rate must be greater than 0');
  if (!i.marginDivisors.length || i.marginDivisors.some((d) => !(d > 0 && d <= 1)))
    throw new Error('Margin divisors must be between 0 and 1');
  const step = i.roundTo ?? 1;
  if (!(step > 0)) throw new Error('Rounding step must be greater than 0');

  // Price on request: the item is registered with cost and retail at 0 for every entity.
  if (i.vendorPrice === 0) return { costPrice: 0, landedCost: 0, retailPrice: 0 };

  const buying =
    i.costMethod === 'discount_from_msrp'
      ? i.vendorPrice * (1 - i.discountPct / 100)
      : i.vendorPrice;
  const landed = buying * i.exRate * (1 + i.overheadPct / 100);

  let retail: number;
  if (i.fixedRetail !== undefined && i.fixedRetail !== null) {
    if (!(i.fixedRetail > 0)) throw new Error('Local MSRP must be greater than 0');
    retail = i.fixedRetail;
  } else {
    retail = safeRoundUp(i.marginDivisors.reduce((value, d) => value / d, landed), step);
  }

  return { costPrice: round2(buying), landedCost: round2(landed), retailPrice: retail };
}
