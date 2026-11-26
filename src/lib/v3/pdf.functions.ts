// pdf.functions.ts: PDF Pricelist data. Items = the brand's ERP-active items for the entity, priced with the
// latest approved ticket's retail, else the entity's ERP retail (gaps 21, 24). Ordered by the learned brand order (gap 22).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const pdfOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ok } = await import("@/server/v3/core.server");
    const [brands, entities, history] = await Promise.all([
      context.supabase.rpc("list_brands_v3").then(ok),
      context.supabase
        .from("entities")
        .select("code,name,currency,region,pdf_allowed")
        .eq("active", true)
        .order("sort_order")
        .then(ok),
      context.supabase
        .from("pdf_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20)
        .then(ok),
    ]);
    const core = await import("@/server/v3/core.server");
    const scope = await core.brandScope(await core.adminDb(), context.userId);
    return {
      brands: brands
        .filter((b) => !scope || scope.has(b.brand_activity.toUpperCase()))
        .map((b) => ({
          brand: b.brand_activity,
          entities: b.entity_codes,
          hasLogo: b.has_logo,
        })),
      entities,
      history,
    };
  });

export const pdfItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1),
      entityCode: z.string().min(1),
      includeInactive: z.boolean().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { headingsBefore, placeItems } = await import("@/lib/nmk/pdfOrder");
    const { pricelistChecks, pricelistTitle } = await import("@/lib/nmk/pricelistPdf");
    const { codeKey, isDemoCode } = await import("@/lib/nmk/util");
    const db = await core.adminDb();
    await core.requireBrand(db, context.userId, data.brand);
    const [entities, settings] = await Promise.all([core.loadEntities(db), core.loadSettings(db)]);
    const e = entities.find((x) => x.code === data.entityCode);
    if (!e) throw new Error("Unknown entity");
    if (!e.pdfAllowed) throw new Error(`${e.name} has no PDF template yet`);
    const master = core.masterOf(entities, e.region);
    const [own, masterItems, approved, order, brandRow] = await Promise.all([
      core.loadBrandErp(db, e.code, data.brand),
      e.code === master ? Promise.resolve([]) : core.loadBrandErp(db, master, data.brand),
      core.allRows<{
        item_code: string;
        description: string | null;
        retail_price: number | null;
        inactive: number | null;
        ticket_id: string | null;
      }>((a, b) =>
        db
          .from("approved_prices")
          .select("item_code,description,retail_price,inactive,ticket_id")
          .eq("entity_code", e.code)
          .ilike("brand_activity", core.likeExact(data.brand))
          .range(a, b),
      ),
      db
        .from("pdf_orders")
        .select("item_codes")
        .ilike("brand_activity", core.likeExact(data.brand))
        .maybeSingle()
        .then((r) => r.data?.item_codes ?? []),
      db
        .from("brands")
        .select("brand_activity,logo_path")
        .ilike("brand_activity", core.likeExact(data.brand))
        .maybeSingle()
        .then((r) => r.data),
    ]);
    // The item list: the entity's own ERP data, else the region master's (codes, descriptions, status, categories).
    const base = own.length ? own : masterItems;
    const byCode = new Map(base.map((i) => [codeKey(i.itemCode), i]));
    const ownByCode = new Map(own.map((i) => [codeKey(i.itemCode), i]));
    const appr = new Map(approved.map((a) => [codeKey(a.item_code), a]));
    // Approved new items that are not in the ERP data yet: their categories come from the ticket rows.
    const extra = approved.filter((a) => !byCode.has(codeKey(a.item_code)));
    const extraCats = new Map<string, { sub: string; cat: string }>();
    const ticketIds = [...new Set(extra.map((a) => a.ticket_id).filter((x): x is string => !!x))];
    if (ticketIds.length) {
      const rows = core.ok(
        await db
          .from("ir_ticket_rows")
          .select("item_code,erp")
          .in("ticket_id", ticketIds)
          .eq("entity_code", e.code)
          .limit(20000),
      );
      for (const r of rows) {
        const v = r.erp as Record<string, unknown>;
        extraCats.set(codeKey(r.item_code), {
          sub: String(v["Sub Category Name"] ?? ""),
          cat: String(v["Category Name"] ?? ""),
        });
      }
    }
    type Item = {
      itemCode: string;
      description: string;
      retail: number | null;
      inactive: number | null;
      subCategoryCode: string;
      categoryCode: string;
      priceFrom: "approved" | "erp" | "none";
    };
    const items: Item[] = [];
    for (const i of base) {
      if (isDemoCode(i.itemCode)) continue;
      const a = appr.get(codeKey(i.itemCode));
      const ownRetail = ownByCode.get(codeKey(i.itemCode))?.retail ?? null;
      const retail = a?.retail_price ?? ownRetail;
      items.push({
        itemCode: i.itemCode,
        description: i.description || a?.description || "",
        retail: retail === null ? null : Number(retail),
        inactive: a?.inactive ?? i.inactive,
        subCategoryCode: i.subCategoryCode,
        categoryCode: i.categoryCode,
        priceFrom:
          a?.retail_price !== null && a?.retail_price !== undefined
            ? "approved"
            : ownRetail !== null
              ? "erp"
              : "none",
      });
    }
    for (const a of extra) {
      if (isDemoCode(a.item_code)) continue;
      const c = extraCats.get(codeKey(a.item_code));
      items.push({
        itemCode: a.item_code,
        description: a.description ?? "",
        retail: a.retail_price === null ? null : Number(a.retail_price),
        inactive: a.inactive,
        subCategoryCode: c?.sub ?? "",
        categoryCode: c?.cat ?? "",
        priceFrom: "approved",
      });
    }
    const active = items.filter((i) => data.includeInactive || i.inactive !== 1);
    const placed = placeItems(order, active);
    return {
      entity: {
        code: e.code,
        name: e.name,
        currency: e.currency,
        legalName: e.legalName,
        termsLine: e.pdfTermsLine,
        logoPath: e.pdfLogoPath,
      },
      brand: {
        name: brandRow?.brand_activity ?? data.brand,
        logoPath: brandRow?.logo_path ?? null,
      },
      title: pricelistTitle(),
      noticeLine: settings.pdfNoticeLine,
      confidentialLine: settings.pdfConfidentialLine,
      items: placed.map((p) => ({
        itemCode: p.itemCode,
        description: p.description,
        retail: p.retail,
        placedBy: p.placedBy,
        priceFrom: p.priceFrom,
      })),
      inactiveLeftOut: items.length - active.length,
      hasOrder: order.length > 0,
      headings: headingsBefore(
        order,
        placed.map((p) => p.itemCode),
      ),
      checks: pricelistChecks(placed),
    };
  });

export const recordPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string(),
      entityCode: z.string(),
      title: z.string().max(200),
      itemCount: z.number().int().min(0),
    }),
  )
  .handler(async ({ data, context }) => {
    const { ok } = await import("@/server/v3/core.server");
    ok(
      await context.supabase
        .from("pdf_history")
        .insert({
          brand_activity: data.brand,
          entity_code: data.entityCode,
          title: data.title,
          item_count: data.itemCount,
          created_by: context.userId,
        })
        .select("id"),
    );
    return { ok: true };
  });
