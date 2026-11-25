// types.ts: the shapes that move through the Standard Item Registration wizard and the ticket.

export type Region = "ME" | "SEA";

export interface Entity {
  code: string; // "001"
  name: string; // "NMK 001"
  region: Region;
  currency: string; // selling currency, "AED"
  isMaster: boolean; // 001 for ME, 012 for SEA
  sortOrder?: number;
}

/** Step 1: one per ticked entity. ownCost = "Different cost for this entity" (gap 21b). */
export interface TicketEntity {
  code: string;
  costCurrency: string;
  ownCost: boolean;
}

/** Steps 2A/2B both end with this list. cost = the standard cost; entityCosts = own-cost entities only. */
export interface Line {
  lineNo: number;
  itemCode: string;
  altCode: string;
  description: string;
  altDescription: string;
  cost: number | null;
  entityCosts: Record<string, number | null>;
  priceOnRequest: boolean; // cost 0 on purpose
  source?: { sheet?: string; row?: number; page?: number };
}

/** Step 4 fields for a code that is not in the region master's ERP data. */
export interface NewItemFields {
  altCode: string;
  altDescription: string;
  familyCode: string;
  groupCode: string;
  subCategoryCode: string; // the Category pick (unique key), Category and Midwich follow from it
  unitCode: string; // "pc"
  subActivity: string;
  inactive: 0 | 1; // ERP status: Active = 0, Inactive = 1
  showOnWeb: boolean | null; // Website: show the product (Webactive 1)
  showPrices?: boolean | null; // B2B: show its prices on the website (B2B 1). Off when the product is hidden
}

export interface TicketLine extends Line {
  isNew: boolean;
  include: boolean; // new codes: the user decides whether to register each one
  useVendorDescription: boolean; // existing codes: gap 8 (ERP description kept by default)
  erpDescription?: string;
  vendorDescription?: string; // the pricelist wording, kept when the description is replaced (AI or typed)
  aiDescription?: string; // what the AI suggested, for learning
  newItem?: NewItemFields;
}

/** Step 5 */
export interface SupplierAnswer {
  entityCode: string;
  supplierCode: string; // what the system has
  supplierName: string;
  answer: "correct" | "different" | null;
  newName?: string;
  newCode?: string;
}

export interface TicketDraft {
  brand: string;
  region: Region;
  stdCurrency: string;
  entities: TicketEntity[];
  source: "ai" | "template";
  lines: TicketLine[];
  suppliers: SupplierAnswer[];
  specialInstructions?: string;
  neededBy?: string | undefined; // YYYY-MM-DD, required at Complete
  effectiveFrom?: string | undefined; // YYYY-MM-DD, optional
}

export type TicketStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "awaiting_approval"
  | "on_hold"
  | "approved"
  | "rejected"
  | "uploaded"
  | "verified";

/** Words shown to people. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  awaiting_approval: "Awaiting approval",
  on_hold: "On hold",
  approved: "Approved",
  rejected: "Rejected",
  uploaded: "Uploaded to ERP",
  verified: "Verified in ERP",
};

/** The 10 currencies (gap 26). */
export const CURRENCIES = [
  "USD",
  "EUR",
  "AED",
  "QAR",
  "SAR",
  "CHF",
  "IDR",
  "MYR",
  "SGD",
  "GBP",
] as const;
