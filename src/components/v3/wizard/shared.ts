// Shared types and helpers for the Standard Item Registration wizard.
import type { wizardOptions, priceCheck } from "@/lib/v3/wizard.functions";
import type { CategoryRow } from "@/lib/nmk/categories";
import type { TicketDraft, TicketLine, Line } from "@/lib/nmk/types";
import { subActivityOptions, suggestSubActivity, trainSubActivity } from "@/lib/nmk/subActivity";

export type Options = Awaited<ReturnType<typeof wizardOptions>>;
export type PriceCheckData = Awaited<ReturnType<typeof priceCheck>>;
export type Brand = Options["brands"][number];

export interface StepProps {
  draft: TicketDraft;
  setDraft: (fn: (d: TicketDraft) => TicketDraft) => void;
  opts: Options;
  goTo: (step: number) => void;
  next: (updated?: TicketDraft) => Promise<void>;
  back: () => void;
  busy: boolean;
}

export const STEPS = [
  "Brand",
  "Prices",
  "Price check",
  "New items",
  "Suppliers",
  "Check",
  "Complete",
];

export const emptyDraft = (): TicketDraft => ({
  brand: "",
  region: "ME",
  stdCurrency: "USD",
  entities: [],
  source: "template",
  lines: [],
  suppliers: [],
});

export const regionOf = (r: string) => (/south|sea/i.test(r) ? "SEA" : "ME") as "ME" | "SEA";
export const regionLabel = (r: "ME" | "SEA") => (r === "ME" ? "Middle East" : "South East Asia");

export function toCategoryRows(opts: Options): CategoryRow[] {
  const mw = new Map(opts.midwich.map((m) => [m.code, m.name]));
  return opts.categories.map((c) => ({
    familyCode: c.family_code,
    familyName: c.family_name,
    groupCode: c.group_code,
    groupName: c.group_name,
    categoryCode: c.category_code,
    categoryName: c.category_name,
    subCategoryCode: c.sub_category_code,
    midwichCode: c.midwich_code,
    midwichName: mw.get(c.midwich_code) ?? "",
    reviewNote: "",
  }));
}

export const toTicketLine = (l: Line): TicketLine => ({
  ...l,
  isNew: false,
  include: true,
  useVendorDescription: false,
});

export const brandOf = (opts: Options, brand: string) =>
  opts.brands.find((b) => b.brand_activity.toUpperCase() === brand.toUpperCase());

export async function loadExcelJS() {
  const mod = (await import("exceljs")) as unknown as { Workbook?: unknown; default?: unknown };
  return mod.Workbook ? mod : mod.default;
}

/** Sub Activity choices for a brand (admin list + the ERP's) and a recommender trained on the brand's items. */
export function subActivityKit(brand: Brand | undefined, pc: PriceCheckData | null) {
  const known = pc?.known ?? [];
  const options = subActivityOptions(brand?.sub_activities ?? [], known);
  const model = trainSubActivity(known, options);
  return {
    options,
    suggest: (itemCode: string, description: string) =>
      suggestSubActivity(model, itemCode, description),
  };
}
