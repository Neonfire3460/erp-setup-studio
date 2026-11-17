// Spec section 10.2: the 9 pricing self-test cases. Server-only (contains rule numbers).
import { processSubmission, type EntityInfo, type ProcessContext } from "./shared/processing";

export const ENTITIES: Record<string, EntityInfo> = {
  "001": { code: "001", name: "NMK 001", currency: "AED", sortOrder: 1 },
  "011": { code: "011", name: "NMK 011", currency: "AED", sortOrder: 2 },
  "007": { code: "007", name: "EDGE 007", currency: "QAR", sortOrder: 3 },
  "008": { code: "008", name: "NMK KSA 008", currency: "SAR", sortOrder: 4 },
  "012": { code: "012", name: "Singapore 012", currency: "SGD", sortOrder: 5 },
  "013": { code: "013", name: "Malaysia 013", currency: "MYR", sortOrder: 6 },
  "014": { code: "014", name: "Indonesia 014", currency: "IDR", sortOrder: 7 },
};

export interface SelfTestCase { n: number; brand: string; entity: string; costCurrency: string; cost: number; overhead: number; divisors: number[]; roundTo: number; rate: number; expected: number }

export const SELF_TEST_CASES: SelfTestCase[] = [
  { n: 1, brand: "Lightware", entity: "001", costCurrency: "AED", cost: 2700, overhead: 0, divisors: [0.6], roundTo: 1, rate: 1, expected: 4500 },
  { n: 2, brand: "Lightware", entity: "011", costCurrency: "AED", cost: 2700, overhead: 0, divisors: [0.6], roundTo: 1, rate: 1, expected: 4500 },
  { n: 3, brand: "Lightware", entity: "007", costCurrency: "USD", cost: 720, overhead: 11, divisors: [0.6], roundTo: 100, rate: 3.65, expected: 4900 },
  { n: 4, brand: "Lightware", entity: "008", costCurrency: "USD", cost: 720, overhead: 5, divisors: [0.6], roundTo: 100, rate: 3.75, expected: 4800 },
  { n: 5, brand: "Lightware", entity: "008", costCurrency: "USD", cost: 0, overhead: 5, divisors: [0.6], roundTo: 100, rate: 3.75, expected: 0 },
  { n: 6, brand: "Turtle AV", entity: "001", costCurrency: "USD", cost: 95.06, overhead: 10, divisors: [0.5], roundTo: 1, rate: 3.675, expected: 769 },
  { n: 7, brand: "Turtle AV", entity: "008", costCurrency: "USD", cost: 95.06, overhead: 15, divisors: [0.5], roundTo: 1, rate: 3.75, expected: 820 },
  { n: 8, brand: "Brightsign", entity: "008", costCurrency: "USD", cost: 650, overhead: 11, divisors: [0.75, 0.75], roundTo: 1, rate: 3.75, expected: 4810 },
  { n: 9, brand: "DTEN", entity: "014", costCurrency: "EUR", cost: 100, overhead: 10, divisors: [0.6], roundTo: 1, rate: 18000, expected: 3300000 },
];

// Runs one case through processSubmission with an in-memory context (no database rules).
export function runCase(c: SelfTestCase) {
  const ctx: ProcessContext = {
    brandActivity: c.brand,
    entities: ENTITIES,
    rules: [{ brandActivity: c.brand, subActivity: null, entityCode: c.entity, method: "calculate", sourceEntity: null, overheadPct: c.overhead, marginDivisors: c.divisors, roundTo: c.roundTo, maxDiscountPct: null }],
    rates: { [`${c.costCurrency}>${c.entity}`]: c.rate },
    suppliers: { [c.entity]: "SELFTEST" },
    brandDefaultUnit: "pc",
    erp: () => null,
    defaults: { inactive: 0, webactive: 0, b2b: 0 },
  };
  const result = processSubmission([{ entityCode: c.entity, costCurrency: c.costCurrency, rows: [{ row: 2, itemCode: `TEST${c.n}`, alternativeCode: "", description: "Self-test item", alternateDescription: "", brandActivity: c.brand, subActivity: c.brand, costPrice: c.cost, measurementUnit: "" }] }], ctx);
  const retail = result.outputs[0]?.values["Retail Price"];
  return { pass: result.tickets.length === 0 && retail === c.expected, retail };
}
