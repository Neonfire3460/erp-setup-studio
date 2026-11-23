// pricing.ts: NMK retail formula. BACKEND ONLY in production (rates, overheads and margins are confidential).
// Verified 23 Nov 2026: reproduces all 59 Turtle AV retail prices in the NMK 001 ERP export, and the
// 011 / 007 / 008 prices in the Turtle AV Q4 2026 PDFs.
//
//   Landed = Cost x Exchange rate x (1 + Overhead %)
//   MSRP   = Landed / divisor (/ second divisor ...)
//   Retail = MSRP rounded UP to a multiple of round_to (1, 10 or 100), set per brand + entity

export interface FxRate {
  from: string;
  to: string;
  rate: number;
}

export interface PricingRule {
  brand: string;
  entityCode: string;
  subActivity?: string | null; // null = every sub activity of the brand
  overheadPct: number; // 10 means 10 %
  marginDivisors: number[]; // [0.5] means landed / 0.5
  roundTo: number; // 1, 10, 100
  maxDiscount?: number | null; // 25 means 25 (plain number in the ERP file)
  active?: boolean;
}

export interface Breakdown {
  cost: number; // in costCurrency, 2 decimals (ERP "Cost Price")
  costCurrency: string;
  sellCurrency: string; // the entity's currency
  fx: number;
  overheadPct: number;
  landed: number; // sell currency, 2 decimals (display only)
  divisors: number[];
  msrp: number; // sell currency, 2 decimals (display only)
  roundTo: number;
  retail: number; // ERP "Retail Price"
  manual?: boolean; // retail typed by the reviewer
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Round up to a multiple of step after snapping to 6 decimals, so 4810.000000000001 stays 4810. */
export const safeRoundUp = (n: number, step = 1) => Math.ceil(Number((n / step).toFixed(6))) * step;

export function calcRetail(i: {
  cost: number;
  costCurrency: string;
  sellCurrency: string;
  fx: number;
  overheadPct: number;
  marginDivisors: number[];
  roundTo: number;
}): Breakdown {
  if (!(i.cost >= 0)) throw new Error("Cost must be 0 or more");
  if (!(i.fx > 0)) throw new Error("Exchange rate must be more than 0");
  if (!i.marginDivisors.length || i.marginDivisors.some((d) => !(d > 0 && d <= 1)))
    throw new Error("Margin divisors must be more than 0 and at most 1");
  if (!(i.roundTo > 0)) throw new Error("Rounding must be more than 0");
  const landed = i.cost * i.fx * (1 + i.overheadPct / 100);
  const msrp = i.marginDivisors.reduce((v, d) => v / d, landed);
  // Price on request: cost 0 gives retail 0 in every entity.
  const retail = i.cost === 0 ? 0 : safeRoundUp(msrp, i.roundTo);
  return {
    cost: r2(i.cost),
    costCurrency: i.costCurrency,
    sellCurrency: i.sellCurrency,
    fx: i.fx,
    overheadPct: i.overheadPct,
    landed: r2(landed),
    divisors: [...i.marginDivisors],
    msrp: r2(msrp),
    roundTo: i.roundTo,
    retail,
  };
}

/** Exchange rate cost currency -> sell currency. Same currency = 1. null when the pair is missing. */
export function findFx(rates: FxRate[], from: string, to: string): number | null {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  const r = rates.find(
    (x) => x.from.toUpperCase() === from.toUpperCase() && x.to.toUpperCase() === to.toUpperCase(),
  );
  return r && r.rate > 0 ? r.rate : null;
}

/** Rule for brand + entity: the Sub Activity rule first, else the brand-wide one. null when missing. */
export function findRule(
  rules: PricingRule[],
  brand: string,
  entityCode: string,
  subActivity?: string | null,
) {
  const b = brand.toUpperCase();
  const mine = rules.filter(
    (r) => r.active !== false && r.brand.toUpperCase() === b && r.entityCode === entityCode,
  );
  const sub = subActivity
    ? mine.find((r) => (r.subActivity ?? "").toUpperCase() === subActivity.toUpperCase())
    : undefined;
  return sub ?? mine.find((r) => !r.subActivity) ?? null;
}

// ---------- Pricing self-test (Admin > Pricing self-test) ----------

export const SELF_TEST_CASES: {
  name: string;
  cost: number;
  costCurrency: string;
  sellCurrency: string;
  fx: number;
  overheadPct: number;
  marginDivisors: number[];
  roundTo: number;
  expected: number;
}[] = [
  {
    name: "Turtle AV TAV-D2BEN 001",
    cost: 95.06,
    costCurrency: "USD",
    sellCurrency: "AED",
    fx: 3.675,
    overheadPct: 10,
    marginDivisors: [0.5],
    roundTo: 1,
    expected: 769,
  },
  {
    name: "Turtle AV TAV-D2BEN 011",
    cost: 95.06,
    costCurrency: "USD",
    sellCurrency: "AED",
    fx: 3.675,
    overheadPct: 5,
    marginDivisors: [0.5],
    roundTo: 1,
    expected: 734,
  },
  {
    name: "Turtle AV TAV-D2BEN 007",
    cost: 95.06,
    costCurrency: "USD",
    sellCurrency: "QAR",
    fx: 3.65,
    overheadPct: 15,
    marginDivisors: [0.5],
    roundTo: 1,
    expected: 799,
  },
  {
    name: "Turtle AV TAV-D2BEN 008",
    cost: 95.06,
    costCurrency: "USD",
    sellCurrency: "SAR",
    fx: 3.75,
    overheadPct: 15,
    marginDivisors: [0.5],
    roundTo: 1,
    expected: 820,
  },
  {
    name: "Turtle AV TAV-BBHDMI-RX 001",
    cost: 314.55,
    costCurrency: "USD",
    sellCurrency: "AED",
    fx: 3.675,
    overheadPct: 10,
    marginDivisors: [0.5],
    roundTo: 1,
    expected: 2544,
  },
  {
    name: "Lightware 001 (AED cost)",
    cost: 2700,
    costCurrency: "AED",
    sellCurrency: "AED",
    fx: 1,
    overheadPct: 0,
    marginDivisors: [0.6],
    roundTo: 1,
    expected: 4500,
  },
  {
    name: "Lightware 007 (round to 100)",
    cost: 720,
    costCurrency: "USD",
    sellCurrency: "QAR",
    fx: 3.65,
    overheadPct: 11,
    marginDivisors: [0.6],
    roundTo: 100,
    expected: 4900,
  },
  {
    name: "Lightware 008 (round to 100)",
    cost: 720,
    costCurrency: "USD",
    sellCurrency: "SAR",
    fx: 3.75,
    overheadPct: 5,
    marginDivisors: [0.6],
    roundTo: 100,
    expected: 4800,
  },
  {
    name: "Price on request",
    cost: 0,
    costCurrency: "USD",
    sellCurrency: "SAR",
    fx: 3.75,
    overheadPct: 5,
    marginDivisors: [0.6],
    roundTo: 100,
    expected: 0,
  },
  {
    name: "Two divisors (float edge)",
    cost: 650,
    costCurrency: "USD",
    sellCurrency: "SAR",
    fx: 3.75,
    overheadPct: 11,
    marginDivisors: [0.75, 0.75],
    roundTo: 1,
    expected: 4810,
  },
  {
    name: "IDR (float edge)",
    cost: 100,
    costCurrency: "EUR",
    sellCurrency: "IDR",
    fx: 18000,
    overheadPct: 10,
    marginDivisors: [0.6],
    roundTo: 1,
    expected: 3300000,
  },
];

export function runSelfTest() {
  return SELF_TEST_CASES.map((c) => {
    const got = calcRetail(c).retail;
    return { name: c.name, expected: c.expected, got, pass: got === c.expected };
  });
}
