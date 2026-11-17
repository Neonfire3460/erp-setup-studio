import { z } from "zod";
export const checkSchema = z.object({
  level: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
});
export const rowSchema = z.object({
  row: z.number().int().min(2),
  itemCode: z.string().trim().min(1),
  alternativeCode: z.string(),
  description: z.string().min(1).max(25500),
  alternateDescription: z.string(),
  brandActivity: z.string(),
  subActivity: z.string(),
  costPrice: z.number().finite().min(0),
  costRaw: z.string(),
  measurementUnit: z.string(),
});
export const submitSchema = z.object({
  brand: z.string().min(1),
  path: z.string(),
  sheets: z
    .array(
      z.object({
        entityCode: z.string(),
        costCurrency: z.string(),
        rows: z.array(rowSchema).min(1),
      }),
    )
    .min(1),
});
export const idSchema = z.object({ id: z.string().uuid() });
export const ticketSchema = idSchema.extend({
  allSubs: z.boolean().default(false),
  overhead: z.number().finite().default(0),
  divisors: z.array(z.number().gt(0).max(1)).min(1).default([0.75]),
  round: z.number().positive().finite().default(1),
  maxDiscount: z.number().finite().nullable().default(null),
  compare: z.boolean().default(false),
  rate: z.number().positive().finite().default(1),
  supplier: z.string().default(""),
});
export type TicketDraft = z.infer<typeof ticketSchema>;
export type Check = z.infer<typeof checkSchema>;
export const statusLabel = (s: string) =>
  s === "needs_pricing"
    ? "Waiting for pricing"
    : s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const hasErrors = (checks: Check[]) => checks.some((c) => c.level === "error");
export const asChecks = (v: unknown): Check[] => z.array(checkSchema).catch([]).parse(v);
export const jsonValue = <T>(v: T) => JSON.parse(JSON.stringify(v));
export const headFor = (title: string, description: string) => ({
  meta: [
    { title: `${title} · NMK Unite` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · NMK Unite` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
export function downloadBlob(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
