import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pair = z.tuple([z.string().min(1).max(200), z.string().min(1).max(200)]);

// Admin only. Swaps the staged rows of one entity in a single transaction, then fills brands,
// sub activities and (only where missing) this entity's supplier codes.
export const finishErpImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    entity_code: z.string().min(1).max(10),
    batch_id: z.string().uuid(),
    expected_count: z.number().int().positive(),
    file_name: z.string().max(300),
    sub_activities: z.array(pair).max(50000),
    suppliers: z.array(pair).max(20000),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const swap = await supabaseAdmin.rpc("swap_erp_items", { _user_id: context.userId, _entity_code: data.entity_code, _batch_id: data.batch_id, _expected_count: data.expected_count, _file_name: data.file_name });
    if (swap.error) { console.error(swap.error); throw new Error("The ERP data could not be replaced. The old rows are unchanged."); }

    const brands = [...new Set([...data.sub_activities.map((p) => p[0]), ...data.suppliers.map((p) => p[0])])];
    let newBrands = 0, newSubs = 0, newSuppliers = 0;
    for (let i = 0; i < brands.length; i += 1000) {
      const r = await supabaseAdmin.from("brands").upsert(brands.slice(i, i + 1000).map((b) => ({ brand_activity: b })), { onConflict: "brand_activity", ignoreDuplicates: true }).select("brand_activity");
      if (r.error) throw new Error("Could not add brands");
      newBrands += r.data.length;
    }
    for (let i = 0; i < data.sub_activities.length; i += 1000) {
      const r = await supabaseAdmin.from("sub_activities").upsert(data.sub_activities.slice(i, i + 1000).map(([b, s]) => ({ brand_activity: b, sub_activity: s })), { onConflict: "brand_activity,sub_activity", ignoreDuplicates: true }).select("sub_activity");
      if (r.error) throw new Error("Could not add sub activities");
      newSubs += r.data.length;
    }
    for (let i = 0; i < data.suppliers.length; i += 1000) {
      const r = await supabaseAdmin.from("brand_suppliers").upsert(data.suppliers.slice(i, i + 1000).map(([b, s]) => ({ brand_activity: b, entity_code: data.entity_code, supplier: s })), { onConflict: "brand_activity,entity_code", ignoreDuplicates: true }).select("supplier");
      if (r.error) throw new Error("Could not add supplier codes");
      newSuppliers += r.data.length;
    }
    return { rows: swap.data, newBrands, newSubs, newSuppliers };
  });
