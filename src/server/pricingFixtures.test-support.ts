// Concrete spec section 3 values, kept only in server-side tests.
export const RULES: Record<string, { method: "discount_from_msrp" | "net_price"; disc: number; div: number[]; ents: Record<string, [number, number]> }> = {
  "Brightsign/Brightsign/USD": { method: "discount_from_msrp", disc: 35, div: [0.75, 0.75], ents: { "001": [3.675, 10], "011": [3.675, 5], "007": [3.65, 18], "008": [3.75, 11] } },
  "Ampetronic/Ampetronic/GBP": { method: "net_price", disc: 0, div: [0.5], ents: { "001": [5.1, 16] } },
  "Lightware/Lightware/USD": { method: "discount_from_msrp", disc: 40, div: [0.6], ents: { "001": [1, 0], "011": [3.675, 0], "007": [3.65, 11], "008": [3.75, 5] } },
  "Turtle AV/Turtle AV/USD": { method: "net_price", disc: 0, div: [0.5], ents: { "001": [3.675, 10], "011": [3.675, 5], "007": [3.65, 15], "008": [3.75, 15] } },
  "DTEN/DTEN/USD": { method: "net_price", disc: 0, div: [0.7], ents: { "012": [1.35, 10], "013": [4.7, 10], "014": [16000, 10] } },
};
export function entitySettings(brand: string, code: string) {
  return { cost_basis: brand === "Lightware" && code === "001" ? "local_msrp" : "vendor_price", retail_method: brand === "Lightware" && ["001", "011"].includes(code) ? "local_msrp" : "calculate", round_to: brand === "Lightware" && ["007", "008"].includes(code) ? 100 : 1 };
}