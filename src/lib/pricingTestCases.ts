// Section 8 pricing test cases (expected values from docs/SPEC.md).
export interface PricingTestCase {
  brand: string;
  sub: string;
  currency: string;
  vendorPrice: number;
  localMsrp?: number;
  entity: string;
  costPrice: number;
  retailPrice: number;
}

export const PRICING_TEST_CASES: PricingTestCase[] = [
  { brand: "Brightsign", sub: "Brightsign", currency: "USD", vendorPrice: 1000, entity: "001", costPrice: 650, retailPrice: 4672 },
  { brand: "Brightsign", sub: "Brightsign", currency: "USD", vendorPrice: 1000, entity: "008", costPrice: 650, retailPrice: 4810 },
  { brand: "Ampetronic", sub: "Ampetronic", currency: "GBP", vendorPrice: 200, entity: "001", costPrice: 200, retailPrice: 2367 },
  { brand: "Lightware", sub: "Lightware", currency: "USD", vendorPrice: 1200, localMsrp: 4500, entity: "001", costPrice: 2700, retailPrice: 4500 },
  { brand: "Lightware", sub: "Lightware", currency: "USD", vendorPrice: 1200, localMsrp: 4500, entity: "011", costPrice: 720, retailPrice: 4500 },
  { brand: "Lightware", sub: "Lightware", currency: "USD", vendorPrice: 1200, localMsrp: 4500, entity: "007", costPrice: 720, retailPrice: 4900 },
  { brand: "Lightware", sub: "Lightware", currency: "USD", vendorPrice: 1200, localMsrp: 4500, entity: "008", costPrice: 720, retailPrice: 4800 },
  { brand: "Turtle AV", sub: "Turtle AV", currency: "USD", vendorPrice: 95.06, entity: "001", costPrice: 95.06, retailPrice: 769 },
  { brand: "Turtle AV", sub: "Turtle AV", currency: "USD", vendorPrice: 95.06, entity: "011", costPrice: 95.06, retailPrice: 734 },
  { brand: "Turtle AV", sub: "Turtle AV", currency: "USD", vendorPrice: 95.06, entity: "007", costPrice: 95.06, retailPrice: 799 },
  { brand: "Turtle AV", sub: "Turtle AV", currency: "USD", vendorPrice: 95.06, entity: "008", costPrice: 95.06, retailPrice: 820 },
  { brand: "DTEN", sub: "DTEN", currency: "USD", vendorPrice: 6246, entity: "012", costPrice: 6246, retailPrice: 13251 },
];
