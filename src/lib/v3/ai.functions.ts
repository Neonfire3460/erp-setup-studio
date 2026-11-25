// ai.functions.ts: Option A. The AI looks at a vendor pricelist's headers and a few sample rows and says which
// column is which. It never sees the whole file, and it never gives codes or prices: those are copied from the
// cells in the browser. A layout the user confirmed is saved per brand and reused without asking the AI again.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const tableSchema = z.object({
  name: z.string().max(120),
  headers: z.array(z.string().max(200)).min(1).max(80),
  samples: z.array(z.array(z.string().max(400)).max(80)).max(12),
});

export type AiPriceColumn = { index: number; label: string; kind: string; currency: string | null };
export type AiLayout = {
  code: number;
  description: number | null;
  altCode: number | null;
  altDescription: number | null;
  priceColumns: AiPriceColumn[];
  cost: number | null;
  entityCost: Record<string, number | null>;
  discountPct: number;
  currencyFound: string | null;
  notes: string[];
};

const TOOL = {
  type: "function",
  function: {
    name: "map_columns",
    description:
      "Say which column of the pricelist holds what. Use column indexes from the headers list (0-based). Never invent values.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "integer",
          description: "Column with the vendor's item code / part number / SKU",
        },
        description: {
          type: ["integer", "null"],
          description: "Short description or product name",
        },
        altCode: {
          type: ["integer", "null"],
          description: "A second code, e.g. EAN/UPC or alternative code. null if none",
        },
        altDescription: {
          type: ["integer", "null"],
          description: "Long description, if a separate column. null if none",
        },
        priceColumns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              label: { type: "string", description: "The header text" },
              kind: {
                type: "string",
                enum: [
                  "msrp",
                  "list",
                  "dealer",
                  "reseller",
                  "distributor",
                  "street",
                  "cost",
                  "net",
                  "map",
                  "other",
                ],
              },
              currency: {
                type: ["string", "null"],
                description: "ISO code if the header or values show one (USD, EUR, AED...)",
              },
            },
            required: ["index", "label", "kind", "currency"],
          },
        },
        suggestedCost: {
          type: ["integer", "null"],
          description: "The price column most likely to be the buyer's cost. null if unclear",
        },
        notes: {
          type: "array",
          items: { type: "string" },
          description: "Short notes, e.g. 'POA rows', 'prices include VAT'",
        },
      },
      required: [
        "code",
        "description",
        "altCode",
        "altDescription",
        "priceColumns",
        "suggestedCost",
        "notes",
      ],
    },
  },
} as const;

/** Reads the saved layout for this brand + header signature, else asks the AI. */
export const aiReadLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1).max(200),
      signature: z.string().max(8000),
      table: tableSchema,
    }),
  )
  .handler(async ({ data }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    const saved = await db
      .from("brand_ai_profiles")
      .select("id,profile,times_used")
      .ilike("brand_activity", core.likeExact(data.brand))
      .eq("header_signature", data.signature)
      .maybeSingle();
    if (saved.data) {
      await db
        .from("brand_ai_profiles")
        .update({ times_used: saved.data.times_used + 1 })
        .eq("id", saved.data.id);
      return {
        layout: saved.data.profile as unknown as AiLayout,
        fromProfile: true,
        aiUsed: false,
        warning: null as string | null,
      };
    }
    const n = data.table.headers.length;
    const ok = (i: unknown): number | null =>
      typeof i === "number" && Number.isInteger(i) && i >= 0 && i < n ? i : null;
    const key = process.env["LOVABLE_API_KEY"];
    if (!key)
      return {
        layout: null,
        fromProfile: false,
        aiUsed: false,
        warning: "The AI is not set up (LOVABLE_API_KEY missing). Pick the columns yourself.",
      };
    const prompt = [
      `Brand: ${data.brand}. Sheet: ${data.table.name}.`,
      `Headers (index: text):\n${data.table.headers.map((h, i) => `${i}: ${h}`).join("\n")}`,
      `First rows (cells in header order, " | " between cells):\n${data.table.samples.map((r) => r.join(" | ")).join("\n")}`,
    ].join("\n\n");
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You map the columns of a vendor's price list for an ERP import. Only use column indexes that exist. Do not output any codes or prices.",
            },
            { role: "user", content: prompt },
          ],
          tools: [TOOL],
          tool_choice: { type: "function", function: { name: "map_columns" } },
        }),
      });
      if (res.status === 429)
        return {
          layout: null,
          fromProfile: false,
          aiUsed: false,
          warning:
            "The AI is busy (rate limit). Pick the columns yourself or try again in a minute.",
        };
      if (res.status === 402)
        return {
          layout: null,
          fromProfile: false,
          aiUsed: false,
          warning: "The Lovable AI credits are used up. Pick the columns yourself.",
        };
      if (!res.ok)
        return {
          layout: null,
          fromProfile: false,
          aiUsed: false,
          warning: `The AI could not read this layout (${res.status}). Pick the columns yourself.`,
        };
      const j = (await res.json()) as {
        choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
      };
      const args = JSON.parse(
        j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}",
      ) as Record<string, unknown>;
      const prices = (Array.isArray(args["priceColumns"]) ? args["priceColumns"] : []) as Record<
        string,
        unknown
      >[];
      const priceColumns: AiPriceColumn[] = prices
        .map((p) => ({
          index: ok(p["index"]) ?? -1,
          label: String(p["label"] ?? ""),
          kind: String(p["kind"] ?? "other"),
          currency:
            typeof p["currency"] === "string" ? p["currency"].toUpperCase().slice(0, 3) : null,
        }))
        .filter((p) => p.index >= 0);
      const code = ok(args["code"]);
      if (code === null)
        return {
          layout: null,
          fromProfile: false,
          aiUsed: true,
          warning: "The AI could not find the item code column. Pick the columns yourself.",
        };
      const sc = ok(args["suggestedCost"]);
      const layout: AiLayout = {
        code,
        description: ok(args["description"]),
        altCode: ok(args["altCode"]),
        altDescription: ok(args["altDescription"]),
        priceColumns,
        cost: priceColumns.length === 1 ? priceColumns[0]!.index : sc,
        entityCost: {},
        discountPct: 0,
        currencyFound: priceColumns.find((p) => p.currency)?.currency ?? null,
        notes: (Array.isArray(args["notes"]) ? args["notes"] : []).map(String).slice(0, 6),
      };
      return { layout, fromProfile: false, aiUsed: true, warning: null };
    } catch (e) {
      return {
        layout: null,
        fromProfile: false,
        aiUsed: false,
        warning: `The AI could not be reached (${e instanceof Error ? e.message : "error"}). Pick the columns yourself.`,
      };
    }
  });

/** Saves the layout the user confirmed, so the next file with the same headers is read without questions. */
export const saveAiLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1).max(200),
      signature: z.string().max(8000),
      layout: z.record(z.string(), z.unknown()),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    const r = await db.from("brand_ai_profiles").upsert(
      {
        brand_activity: data.brand,
        header_signature: data.signature,
        profile: core.json(data.layout),
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_activity,header_signature" },
    );
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });
