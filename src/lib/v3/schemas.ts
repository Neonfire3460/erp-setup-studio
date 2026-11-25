// schemas.ts: input checks shared by the wizard (browser) and the server functions.
import { z } from "zod";

const num = z.number().finite().nullable();

export const lineSchema = z.object({
  lineNo: z.number().int(),
  itemCode: z.string().trim().max(60),
  altCode: z.string().max(60).default(""),
  description: z.string().max(2000).default(""),
  altDescription: z.string().max(2000).default(""),
  cost: num,
  entityCosts: z.record(num).default({}),
  priceOnRequest: z.boolean().default(false),
  source: z
    .object({
      sheet: z.string().optional(),
      row: z.number().optional(),
      page: z.number().optional(),
    })
    .partial()
    .optional(),
  isNew: z.boolean().default(false),
  include: z.boolean().default(true),
  useVendorDescription: z.boolean().default(false),
  erpDescription: z.string().optional(),
  vendorDescription: z.string().max(2000).optional(),
  aiDescription: z.string().max(2000).optional(),
  newItem: z
    .object({
      altCode: z.string().default(""),
      altDescription: z.string().default(""),
      familyCode: z.string().default(""),
      groupCode: z.string().default(""),
      subCategoryCode: z.string().default(""),
      unitCode: z.string().default(""),
      subActivity: z.string().default(""),
      inactive: z.union([z.literal(0), z.literal(1)]),
      showOnWeb: z.boolean().nullable(),
      showPrices: z.boolean().nullable().optional(),
    })
    .optional(),
});

export const draftSchema = z.object({
  brand: z.string().default(""),
  region: z.enum(["ME", "SEA"]).default("ME"),
  stdCurrency: z.string().default("USD"),
  entities: z
    .array(
      z.object({ code: z.string(), costCurrency: z.string(), ownCost: z.boolean().default(false) }),
    )
    .default([]),
  source: z.enum(["ai", "template"]).default("template"),
  lines: z.array(lineSchema).max(20000).default([]),
  suppliers: z
    .array(
      z.object({
        entityCode: z.string(),
        supplierCode: z.string().default(""),
        supplierName: z.string().default(""),
        answer: z.enum(["correct", "different"]).nullable(),
        newName: z.string().optional(),
        newCode: z.string().optional(),
      }),
    )
    .default([]),
  specialInstructions: z.string().max(4000).optional(),
  neededBy: z.string().max(10).optional(),
  effectiveFrom: z.string().max(10).optional(),
});

export const idSchema = z.object({ id: z.string().uuid() });
