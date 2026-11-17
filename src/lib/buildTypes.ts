import { z } from "zod";

export const INPUT_HEADERS = ["Item Code", "Alternative Code", "Description", "Alternate Description", "Det. Description", "Brand Activity", "Sub Activity", "Vendor Price", "Local MSRP", "Max Discount", "Measurement Unit", "Vendor Group", "Vendor Note", "Source"] as const;
export const ERP_HEADERS = ["Supplier", "Item Code", "Alternative Code", "Description", "Alternate Description", "Det. Description", "Brand Activity", "Sub Activity", "Cost Price", "Retail Price", "Max Discount", "Family Name", "Group Name", "Category Name", "Sub Category Name", "Midwich Family", "Measurement Unit", "Inactive", "Webactive", "B2B"] as const;
export type InputRow = Record<typeof INPUT_HEADERS[number], string | number | null>;
export type ErpRow = Record<typeof ERP_HEADERS[number], string | number | null>;
export interface Check { level: "error" | "warning"; message: string }
export interface ReviewRow { inputIndex: number; columns: ErpRow; price_basis: string; checks: Check[] }
export interface EntityReview { entity_code: string; rows: ReviewRow[] }
const cell = z.union([z.string().max(20000), z.number().finite(), z.null()]);
export const inputRowSchema = z.object({
  "Item Code": cell, "Alternative Code": cell, Description: cell, "Alternate Description": cell,
  "Det. Description": cell, "Brand Activity": cell, "Sub Activity": cell, "Vendor Price": cell,
  "Local MSRP": cell, "Max Discount": cell, "Measurement Unit": cell, "Vendor Group": cell, "Vendor Note": cell, Source: cell,
});
export const buildInputSchema = z.object({ brand_activity: z.string().min(1), vendor_currency: z.string().min(1), entity_codes: z.array(z.string()).min(1).max(100), rows: z.array(inputRowSchema).min(1).max(50000) });
export type BuildInput = z.infer<typeof buildInputSchema>;
export const text = (v: unknown) => v == null ? "" : String(v).trim();
export const codeKey = (v: unknown) => text(v).toUpperCase();
export function inputChecks(row: InputRow, rows: InputRow[], brand: string, knownBrand: boolean, activeSub: boolean, supplier: string, needsLocalMsrp = false): Check[] {
  const checks: Check[] = [];
  const error = (message: string) => checks.push({ level: "error", message });
  if (!codeKey(row["Item Code"])) error("Item Code empty");
  else if (rows.filter(r => codeKey(r["Item Code"]) === codeKey(row["Item Code"])).length > 1) error("Same Item Code twice in the file");
  if (typeof row["Vendor Price"] !== "number" || !Number.isFinite(row["Vendor Price"]) || row["Vendor Price"] < 0) error("Vendor Price must be 0 or more");
  if (row["Vendor Price"] === 0) checks.push({ level: "warning", message: "Price on request: Cost Price and Retail Price are 0" });
  if (needsLocalMsrp && row["Vendor Price"] !== 0 && (typeof row["Local MSRP"] !== "number" || !Number.isFinite(row["Local MSRP"]) || row["Local MSRP"] <= 0)) error("Local MSRP must be greater than 0 for this entity");
  if (!knownBrand || text(row["Brand Activity"]) !== brand) error("Unknown or inconsistent Brand Activity");
  if (new Set(rows.map(r => text(r["Brand Activity"]))).size > 1) error("More than one Brand Activity in the file");
  if (!text(row["Sub Activity"])) error("Sub Activity empty");
  else if (!activeSub) error("No active Sub Activity pricing rule for this currency and entity");
  const max = row["Max Discount"];
  if (max !== null && max !== "" && (typeof max !== "number" || max < 0 || max > 100)) error("Max Discount must be between 0 and 100");
  if (!supplier.trim() || supplier.trim().toUpperCase() === "TO SET") error("Brand supplier missing or TO SET for this entity");
  return checks;
}