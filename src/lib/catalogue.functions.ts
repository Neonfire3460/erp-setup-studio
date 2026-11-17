import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
const fields = [
  "item_code",
  "alternative_code",
  "description",
  "alternate_description",
  "retail_price",
  "family_name",
  "group_name",
  "category_name",
  "sub_category_name",
  "midwich_family_name",
] as const;
const filters = [
  "sub_activity",
  "family_name",
  "group_name",
  "category_name",
  "sub_category_name",
  "midwich_family_name",
] as const;
export const catalogueSchema = z.object({
  entity: z.string().default("001"),
  brand: z.string().default(""),
  search: z.string().default(""),
  filters: z.record(z.string()).default({}),
  page: z.number().int().min(0).default(0),
  sort: z.enum(fields).default("item_code"),
  desc: z.boolean().default(false),
  download: z.boolean().default(false),
});
export const catalogueOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checked, allRows } = await import("@/server/submissions.server");
    const [entities, items] = await Promise.all([
      context.supabase
        .from("entities")
        .select("code,name,currency")
        .eq("active", true)
        .order("sort_order")
        .then(checked),
      allRows((a, b) =>
        context.supabase
          .from("catalogue_items")
          .select(
            "entity_code,brand_activity,sub_activity,family_name,group_name,category_name,sub_category_name,midwich_family_name,approved_at",
          )
          .order("entity_code")
          .order("item_code")
          .range(a, b),
      ),
    ]);
    return { entities, items };
  });
export const readCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(catalogueSchema)
  .handler(async ({ data, context }) => {
    const { checked, allRows } = await import("@/server/submissions.server");
    const q = () => {
      let q = context.supabase
        .from("catalogue_items")
        .select(
          "item_code,alternative_code,description,alternate_description,retail_price,currency,family_name,group_name,category_name,sub_category_name,midwich_family_name,approved_at",
          { count: "exact" },
        )
        .eq("entity_code", data.entity)
        .eq("brand_activity", data.brand);
      for (const f of filters) {
        const v = data.filters[f];
        if (v) q = q.eq(f, v);
      }
      const search = data.search.replace(/[,%()]/g, " ").trim();
      if (search)
        q = q.or(
          `item_code.ilike.%${search}%,alternative_code.ilike.%${search}%,description.ilike.%${search}%`,
        );
      return q.order(data.sort, { ascending: !data.desc }).order("item_code");
    };
    if (data.download) return { rows: await allRows((a, b) => q().range(a, b)), count: 0 };
    const r = await q().range(data.page * 100, data.page * 100 + 99);
    return { rows: checked(r), count: r.count ?? 0 };
  });
