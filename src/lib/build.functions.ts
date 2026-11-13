import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { buildInputSchema, inputRowSchema } from "./buildTypes";

export const getBuildOptions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [a, e] = await Promise.all([context.supabase.rpc("list_activities"), context.supabase.from("entities").select("*").order("sort_order")]);
  if (a.error || e.error) throw new Error("Could not load available activities");
  return { activities: a.data ?? [], entities: e.data ?? [] };
});
export const buildErpRows = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(buildInputSchema).handler(async ({ data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildRows } = await import("@/server/buildRows.server");
  return (await buildRows(supabaseAdmin, data)).reviews;
});
export const saveBuildExport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ upload_id: z.string().uuid(), entity_code: z.string(), rows: z.array(inputRowSchema).min(1).max(50000) })).handler(async ({ data, context }) => {
  // Read ownership through RLS, then explicitly require the current user's own build.
  const { data: upload, error } = await context.supabase.from("uploads").select("id,user_id,brand_activity,vendor_currency").eq("id", data.upload_id).single();
  if (error || upload.user_id !== context.userId || !upload.brand_activity || !upload.vendor_currency) throw new Error("Upload not available");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildRows } = await import("@/server/buildRows.server");
  const built = await buildRows(supabaseAdmin, { brand_activity: upload.brand_activity, vendor_currency: upload.vendor_currency, entity_codes: [data.entity_code], rows: data.rows });
  const review = built.reviews[0];
  if (!review || review.rows.some(r => r.checks.some(c => c.level === "error"))) throw new Error("Resolve or exclude error rows before downloading");
  const rows = review.rows.map(r => r.columns);
  const result = await supabaseAdmin.rpc("save_erp_export", { _upload_id: upload.id, _user_id: context.userId, _entity_code: data.entity_code, _rows: rows as unknown as Json, _snapshot: built.snapshots[data.entity_code] as Json });
  if (result.error) throw new Error("Could not save export and audit");
  return { id: result.data, rows };
});
export const getHistory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const uploads = [], exports = [];
  for (let offset = 0; ; offset += 500) {
    const u = await context.supabase.from("uploads").select("id,tool,user_id,brand_activity,vendor_currency,file_name,file_path,created_at").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (u.error) throw new Error("Could not load uploads");
    uploads.push(...u.data);
    if (u.data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const e = await context.supabase.from("exports").select("id,upload_id,user_id,entity_code,row_count,created_at,uploads(brand_activity)").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (e.error) throw new Error("Could not load exports");
    exports.push(...e.data);
    if (e.data.length < 500) break;
  }
  return { uploads, exports };
});
export const getExportRows = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const result = await context.supabase.from("exports").select("rows").eq("id", data.id).single();
  if (result.error) throw new Error("Export not available");
  return result.data.rows;
});