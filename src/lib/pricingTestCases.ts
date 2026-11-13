// Section 8 pricing test cases (expected values from docs/SPEC.md).
export interface PricingTestCase {
  brand: string;
  sub: string;
  currency: string;
  vendorPrice: number;
  entity: string;
  costPrice: number;
  retailPrice: number;
}

export const PRICING_TEST_CASES: PricingTestCase[] = [
  { brand: "Brightsign", sub: "Brightsign", currency: "USD", vendorPrice: 1000, entity: "001", costPrice: 650, retailPrice: 4672 },
  { brand: "Brightsign", sub: "Brightsign", currency: "USD", vendorPrice: 1000, entity: "011", costPrice: 650, retailPrice: 4459 },
  { brand: "Brightsign", sub: "Brightsign", currency: "USD", vendorPrice: 1000, entity: "007", costPrice: 650, retailPrice: 4977 },
  { brand: "Brightsign", sub: "Brightsign", currency: "USD", vendorPrice: 1000, entity: "008", costPrice: 650, retailPrice: 4810 },
  { brand: "Ampetronic", sub: "Ampetronic", currency: "GBP", vendorPrice: 200, entity: "001", costPrice: 200, retailPrice: 2367 },
  { brand: "Lightware", sub: "Lightware", currency: "AED", vendorPrice: 4500, entity: "001", costPrice: 2700, retailPrice: 4950 },
  { brand: "Lightware", sub: "Lightware", currency: "AED", vendorPrice: 4500, entity: "011", costPrice: 2700, retailPrice: 4725 },
  { brand: "Lightware", sub: "Lightware", currency: "USD", vendorPrice: 1200, entity: "007", costPrice: 720, retailPrice: 5169 },
  { brand: "Lightware", sub: "Lightware", currency: "USD", vendorPrice: 1200, entity: "008", costPrice: 720, retailPrice: 4995 },
  { brand: "DTEN", sub: "DTEN", currency: "USD", vendorPrice: 6246, entity: "012", costPrice: 6246, retailPrice: 13251 },
  { brand: "DTEN", sub: "DTEN", currency: "USD", vendorPrice: 6246, entity: "013", costPrice: 6246, retailPrice: 46132 },
  { brand: "DTEN", sub: "DTEN", currency: "USD", vendorPrice: 6246, entity: "014", costPrice: 6246, retailPrice: 157042286 },
];
