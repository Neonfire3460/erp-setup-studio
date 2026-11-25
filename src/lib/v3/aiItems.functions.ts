// aiItems.functions.ts: AI help in the wizard.
//  - aiSuggestNewItems (Step 4): for codes not in the ERP, suggests a description, a long description,
//    the category, unit, sub activity and website setting, from the brand's existing ERP items.
//  - aiDescribe (Step 3): a clean ERP description from the vendor's and the ERP's wording.
// The AI never sets codes or prices. Everything it returns is checked against the real lists, and the user
// can change every value. What people keep or change is saved (ai_description_examples) and shown to the AI
// next time for the same brand, so its wording follows theirs.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const text = (n: number) => z.string().max(n).default("");

async function brandContext(brand: string, region: "ME" | "SEA") {
  const core = await import("@/server/v3/core.server");
  const { descriptionLimit } = await import("@/server/v3/ai.server");
  const db = await core.adminDb();
  const entities = await core.loadEntities(db);
  const master = core.masterOf(entities, region);
  const [erp, examples] = await Promise.all([
    core.loadBrandErp(db, master, brand),
    db
      .from("ai_description_examples")
      .select("vendor_description,erp_description,ai_description,final_description")
      .ilike("brand_activity", core.likeExact(brand))
      .order("created_at", { ascending: false })
      .limit(25)
      .then((r) => r.data ?? []),
  ]);
  const limit = descriptionLimit(erp.map((i) => i.description));
  // Corrections first: those show the AI what people changed.
  const learned = [...examples]
    .sort(
      (a, b) =>
        Number(b.ai_description !== b.final_description) -
        Number(a.ai_description !== a.final_description),
    )
    .slice(0, 15)
    .map(
      (e) =>
        `vendor: ${e.vendor_description || "-"} | ERP: ${e.erp_description || "-"} | AI said: ${e.ai_description || "-"} | kept: ${e.final_description}`,
    );
  return { db, core, erp, limit, learned };
}

const STYLE = (limit: number) =>
  `Write ERP item descriptions: plain text, at most ${limit} characters, no marketing words, no prices, ` +
  `no line breaks. Follow the brand's existing ERP style (word order, abbreviations, capitals). Keep model ` +
  `numbers, sizes and key specs. Use the vendor and ERP wording as the facts; don't invent specs.`;

export const aiSuggestNewItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1).max(200),
      region: z.enum(["ME", "SEA"]),
      subActivities: z.array(z.string().max(100)).max(200),
      units: z.array(z.string().max(20)).max(100),
      items: z
        .array(
          z.object({
            lineNo: z.number().int(),
            itemCode: z.string().max(60),
            description: text(2000),
            altDescription: text(2000),
          }),
        )
        .min(1)
        .max(60),
    }),
  )
  .handler(async ({ data }) => {
    const { callTool } = await import("@/server/v3/ai.server");
    const { core, db, erp, limit, learned } = await brandContext(data.brand, data.region);
    const cats = await core.loadCategories(db);
    const catKeys = new Set(cats.map((c) => c.subCategoryCode));
    // The brand's existing items closest to the new codes (shared code start), as examples.
    const score = (a: string, b: string) => {
      let n = 0;
      while (n < a.length && n < b.length && a[n] === b[n]) n++;
      return n;
    };
    const examples = erp
      .map((i) => ({
        i,
        s: Math.max(
          ...data.items.map((x) => score(x.itemCode.toUpperCase(), i.itemCode.toUpperCase())),
        ),
      }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map(
        ({ i }) =>
          `${i.itemCode} | ${i.description} | long: ${i.altDescription} | cat ${i.subCategoryCode} | unit ${i.mu} | sub ${i.subActivity} | web ${i.web ?? ""}`,
      );
    const prompt = [
      `Brand: ${data.brand}.`,
      `Categories (code: Family > Group > Category):\n${cats.map((c) => `${c.subCategoryCode}: ${c.familyName} > ${c.groupName} > ${c.categoryName}`).join("\n")}`,
      `Units: ${data.units.join(", ")}. Sub Activities: ${data.subActivities.join(", ") || "(none)"}.`,
      examples.length ? `Existing ${data.brand} items in the ERP:\n${examples.join("\n")}` : "",
      learned.length
        ? `Descriptions people approved before (follow them):\n${learned.join("\n")}`
        : "",
      `New items (lineNo | code | vendor description | vendor long description):\n${data.items
        .map((x) => `${x.lineNo} | ${x.itemCode} | ${x.description} | ${x.altDescription}`)
        .join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const r = await callTool<{ items?: Record<string, unknown>[] }>({
      system: `You help register new products in an ERP for an AV distributor. ${STYLE(limit)} Pick only codes from the lists given.`,
      prompt,
      tool: {
        name: "suggest_items",
        description: "Suggestions for each new item, by lineNo.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  lineNo: { type: "integer" },
                  description: {
                    type: "string",
                    description: `ERP description, max ${limit} chars`,
                  },
                  altDescription: {
                    type: "string",
                    description: "Longer description, max 400 chars",
                  },
                  subCategoryCode: {
                    type: ["string", "null"],
                    description: "From the categories list",
                  },
                  unitCode: { type: ["string", "null"] },
                  subActivity: { type: ["string", "null"] },
                  showOnWeb: {
                    type: ["boolean", "null"],
                    description: "Like similar existing items",
                  },
                  why: { type: "string", description: "Max 12 words: why this category" },
                },
                required: [
                  "lineNo",
                  "description",
                  "altDescription",
                  "subCategoryCode",
                  "unitCode",
                  "subActivity",
                  "showOnWeb",
                  "why",
                ],
              },
            },
          },
          required: ["items"],
        },
      },
    });
    const lineNos = new Set(data.items.map((x) => x.lineNo));
    const str = (v: unknown, n: number) =>
      typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
    const items = (r.args?.items ?? [])
      .filter((x) => lineNos.has(Number(x["lineNo"])))
      .map((x) => {
        const sub = str(x["subCategoryCode"], 40).replace(/^AE01_/i, "");
        const cat = cats.find((c) => c.subCategoryCode === sub);
        const unit = str(x["unitCode"], 20);
        const sa = str(x["subActivity"], 100);
        return {
          lineNo: Number(x["lineNo"]),
          description: str(x["description"], limit),
          altDescription: str(x["altDescription"], 400),
          ...(cat && catKeys.has(sub)
            ? { familyCode: cat.familyCode, groupCode: cat.groupCode, subCategoryCode: sub }
            : {}),
          ...(data.units.includes(unit) ? { unitCode: unit } : {}),
          ...(data.subActivities.includes(sa) ? { subActivity: sa } : {}),
          ...(typeof x["showOnWeb"] === "boolean" ? { showOnWeb: x["showOnWeb"] } : {}),
          why: str(x["why"], 120),
        };
      });
    return { items, warning: r.warning, limit };
  });

export const aiDescribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1).max(200),
      region: z.enum(["ME", "SEA"]),
      items: z
        .array(
          z.object({
            lineNo: z.number().int(),
            itemCode: z.string().max(60),
            vendor: text(2000),
            erp: text(2000),
          }),
        )
        .min(1)
        .max(80),
    }),
  )
  .handler(async ({ data }) => {
    const { callTool } = await import("@/server/v3/ai.server");
    const { erp, limit, learned } = await brandContext(data.brand, data.region);
    const style = erp
      .filter((i) => i.description)
      .slice(0, 25)
      .map((i) => `${i.itemCode} | ${i.description}`);
    const r = await callTool<{ items?: Record<string, unknown>[] }>({
      system: `You write ERP item descriptions for an AV distributor. ${STYLE(limit)}`,
      prompt: [
        `Brand: ${data.brand}.`,
        style.length
          ? `The brand's ERP descriptions today (match this style):\n${style.join("\n")}`
          : "",
        learned.length
          ? `Descriptions people approved before (follow them):\n${learned.join("\n")}`
          : "",
        `Items (lineNo | code | vendor description | ERP description):\n${data.items
          .map((x) => `${x.lineNo} | ${x.itemCode} | ${x.vendor} | ${x.erp}`)
          .join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      tool: {
        name: "describe",
        description: "One description per item, by lineNo.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: { lineNo: { type: "integer" }, description: { type: "string" } },
                required: ["lineNo", "description"],
              },
            },
          },
          required: ["items"],
        },
      },
    });
    const ok = new Set(data.items.map((x) => x.lineNo));
    const items = (r.args?.items ?? [])
      .filter((x) => ok.has(Number(x["lineNo"])) && typeof x["description"] === "string")
      .map((x) => ({
        lineNo: Number(x["lineNo"]),
        description: String(x["description"]).replace(/\s+/g, " ").trim().slice(0, limit),
      }))
      .filter((x) => x.description);
    return { items, warning: r.warning, limit };
  });
