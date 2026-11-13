import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ERP_HEADERS, codeKey, text, inputChecks, type BuildInput, type EntityReview, type ErpRow } from "@/lib/buildTypes";
import { calculatePrice } from "./pricing.server";

// Shared by preview, audited export and self-test; snapshots never leave this module's server caller.
export async function buildRows(db: SupabaseClient<Database>, input: BuildInput) {
  const [{ data: brand, error: be }, { data: rules, error: re }, { data: entities, error: ee }] = await Promise.all([
    db.from("brands").select("*").eq("brand_activity", input.brand_activity).maybeSingle(),
    db.from("pricing_rules").select("*, pricing_rule_entities(*)").eq("brand_activity", input.brand_activity).eq("vendor_currency", input.vendor_currency).eq("active", true),
    db.from("entities").select("code"),
  ]);
  if (be || re || ee) throw new Error("Could not load build reference data");
  if (input.entity_codes.some(c => !entities?.some(e => e.code === c))) throw new Error("Unknown entity");
  const codes = [...new Set(input.rows.map(r => codeKey(r["Item Code"])).filter(Boolean))];
  const master = new Map<string, Database["public"]["Tables"]["erp_items"]["Row"]>();
  for (let i = 0; i < codes.length; i += 500) {
    const { data, error } = await db.from("erp_items").select("*").in("item_code", codes.slice(i, i + 500));
    if (error) throw new Error("Could not load ERP master data");
    data?.forEach(r => master.set(r.item_code, r));
  }
  const snapshots: Record<string, unknown[]> = {};
  const reviews: EntityReview[] = [...new Set(input.entity_codes)].map(entity_code => {
    snapshots[entity_code] = [];
    return { entity_code, rows: input.rows.map((row, inputIndex) => {
      const rule = rules?.find(r => r.sub_activity === text(row["Sub Activity"]));
      const ent = rule?.pricing_rule_entities.find(e => e.entity_code === entity_code);
      const erp = master.get(codeKey(row["Item Code"]));
      const checks = inputChecks(row, input.rows, input.brand_activity, Boolean(brand), Boolean(rule && ent), brand?.supplier ?? "");
      const columns = Object.fromEntries(ERP_HEADERS.map(h => [h, ""])) as ErpRow;
      for (const h of ["Item Code", "Alternative Code", "Description", "Alternate Description", "Det. Description", "Brand Activity", "Sub Activity"] as const) columns[h] = row[h];
      columns.Supplier = brand?.supplier ?? "";
      columns["Max Discount"] = row["Max Discount"] === null || row["Max Discount"] === "" ? rule?.max_discount_pct ?? "" : row["Max Discount"];
      const fields = { "Family Name": "family_name", "Group Name": "group_name", "Category Name": "category_name", "Sub Category Name": "sub_category_name", "Midwich Family": "midwich_family", Inactive: "inactive", Webactive: "webactive", B2B: "b2b" } as const;
      for (const [header, field] of Object.entries(fields)) columns[header as keyof ErpRow] = erp?.[field] ?? "";
      columns["Measurement Unit"] = text(row["Measurement Unit"]) || erp?.measurement_unit || brand?.default_unit || "";
      if (!erp) checks.push({ level: "warning", message: "Item not found in ERP master data" });
      if (!text(columns["Measurement Unit"])) checks.push({ level: "warning", message: "Measurement Unit empty" });
      if (!text(row.Description)) checks.push({ level: "warning", message: "Description empty" });
      if (rule && ent && typeof row["Vendor Price"] === "number" && row["Vendor Price"] > 0) {
        try {
          const result = calculatePrice({ vendorPrice: row["Vendor Price"], costMethod: rule.cost_method as "net_price" | "discount_from_msrp", discountPct: Number(rule.discount_pct), exRate: Number(ent.ex_rate), overheadPct: Number(ent.overhead_pct), marginDivisors: rule.margin_divisors.map(Number) });
          columns["Cost Price"] = result.costPrice; columns["Retail Price"] = result.retailPrice;
          snapshots[entity_code]?.push({ inputIndex, rule, entity: ent, landedCost: result.landedCost });
        } catch { checks.push({ level: "error", message: "Pricing rule is invalid; contact an admin" }); }
      }
      return { inputIndex, columns, price_basis: rule?.cost_method === "net_price" ? "Net price" : rule ? "MSRP less discount" : "", checks };
    }) };
  });
  return { reviews, snapshots };
}