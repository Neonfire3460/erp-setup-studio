// erp.functions.ts: ERP data lookups for staff pages. They run on the server with the service role, because
// reading erp_items from the browser checks the staff policy on every row and hits the 8 second limit.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_DIFF_ITEMS = 10000;

/** Every item code of a brand in the active ERP data (all entities): the PDF order learner needs them. */
export const brandErpCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ brand: z.string().trim().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, core.STAFF);
    const entities = await core.loadEntities(db);
    const codes = new Set<string>();
    for (const e of entities) {
      const rows = await core.allRows<{ item_code: string }>(
        (a, b) =>
          db
            .from("erp_items_active")
            .select("item_code")
            .eq("entity_code", e.code)
            .ilike("brand_activity", core.likeExact(data.brand))
            .order("item_code")
            .range(a, b) as never,
      );
      for (const r of rows) codes.add(r.item_code);
    }
    return [...codes];
  });

/**
 * ERP data import preview: the stored items of the brands in the file, so the page can show new / changed / gone.
 * A big file (many brands or over 10,000 stored items) gets the stored count only.
 */
export const storedForBrands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ entityCode: z.string().min(1).max(10), brands: z.array(z.string()).max(20000) }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { rowToErpItem } = await import("@/lib/nmk/erp");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const count = async (brands: string[] | null) => {
      let q = db
        .from("erp_items_active")
        .select("item_code", { count: "exact", head: true })
        .eq("entity_code", data.entityCode);
      if (brands) q = q.in("brand_activity", brands);
      const r = await q;
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    };
    if (data.brands.length > 200)
      return { stored: await count(null), items: null, allBrands: true };
    const chunks: string[][] = [];
    for (let i = 0; i < data.brands.length; i += 50) chunks.push(data.brands.slice(i, i + 50));
    let stored = 0;
    for (const c of chunks) stored += await count(c);
    if (stored > MAX_DIFF_ITEMS) return { stored, items: null, allBrands: false };
    const items = [];
    for (const c of chunks) {
      const rows = await core.allRows(
        (a, b) =>
          db
            .from("erp_items_active")
            .select("*")
            .eq("entity_code", data.entityCode)
            .in("brand_activity", c)
            .order("item_code")
            .range(a, b) as never,
      );
      items.push(...rows.map((r) => rowToErpItem(r as never)));
    }
    return { stored, items, allBrands: false };
  });
