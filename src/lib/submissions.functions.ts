import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { submitSchema, idSchema, ticketSchema, jsonValue } from "./workflow";
import { checkTemplateRows } from "./excelFiles";

export const buildOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checked } = await import("@/server/submissions.server");
    const [brands, entities, currencies] = await Promise.all([
      context.supabase.rpc("list_brands").then(checked),
      context.supabase
        .from("entities")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .then(checked),
      context.supabase
        .from("currencies")
        .select("code")
        .eq("active", true)
        .order("sort_order")
        .then(checked),
    ]);
    return { brands, entities, currencies: currencies.map((c) => c.code) };
  });
export const submitBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(submitSchema)
  .handler(async ({ data, context }) => {
    const { checked, runProcessing } = await import("@/server/submissions.server");
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Invalid upload path");
    const brands = checked(await context.supabase.rpc("list_brands"));
    const brand = brands.find((b) => b.brand_activity === data.brand);
    if (!brand) throw new Error("Unknown brand");
    const entities = checked(
      await context.supabase.from("entities").select("code").eq("active", true),
    );
    const currencies = checked(
      await context.supabase.from("currencies").select("code").eq("active", true),
    );
    const seen = new Set<string>();
    const rows = data.sheets.flatMap((s) => {
      if (
        seen.has(s.entityCode) ||
        !entities.some((e) => e.code === s.entityCode) ||
        !currencies.some((c) => c.code === s.costCurrency)
      )
        throw new Error("Invalid entity or currency");
      seen.add(s.entityCode);
      const r = checkTemplateRows(s.rows, {
        brandActivity: data.brand,
        subActivities: brand.sub_activities,
      });
      if ([...r.checks.values()].flat().some((c) => c.level === "error"))
        throw new Error("Correct all row errors before submitting");
      return r.rows.map((row) => ({
        entity_code: s.entityCode,
        cost_currency: s.costCurrency,
        row_no: row.row,
        item_code: row.itemCode,
        alternative_code: row.alternativeCode,
        description: row.description,
        alternate_description: row.alternateDescription,
        sub_activity: row.subActivity,
        cost_price: row.costPrice,
        measurement_unit: row.measurementUnit,
        checks: r.checks.get(row.row) ?? [],
      }));
    });
    checked(await context.supabase.storage.from("pricelists").download(data.path));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = checked(
      await supabaseAdmin.rpc("create_build_submission", {
        _user: context.userId,
        _brand: data.brand,
        _entities: jsonValue(
          data.sheets.map((s) => ({ entity_code: s.entityCode, cost_currency: s.costCurrency })),
        ),
        _path: data.path,
        _rows: jsonValue(rows),
      }),
    );
    try {
      await runProcessing(supabaseAdmin, id);
    } catch {
      /* saved submission remains retryable */
    }
    return { id };
  });
export const processSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { checked, runProcessing } = await import("@/server/submissions.server");
    const s = checked(
      await context.supabase
        .from("submissions")
        .select("id,user_id,status")
        .eq("id", data.id)
        .single(),
    );
    if (s.status === "approved") throw new Error("Approved submissions are locked");
    if (s.user_id !== context.userId) {
      const admin = checked(
        await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      );
      if (!admin) throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return runProcessing(supabaseAdmin, data.id);
  });
export const mySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { allRows } = await import("@/server/submissions.server");
    return allRows((a, b) =>
      context.supabase
        .from("submissions")
        .select(
          "id,user_id,brand_activity,entities,status,counts,created_at,submitted_at,review_comment",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b),
    );
  });
export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { checked } = await import("@/server/submissions.server");
    const s = checked(
      await context.supabase
        .from("submissions")
        .select("id,user_id,status,file_path")
        .eq("id", data.id)
        .single(),
    );
    if (s.status === "approved") throw new Error("Approved submissions are locked");
    checked(
      await context.supabase.from("submissions").delete().eq("id", s.id).select("id").single(),
    );
    if (s.file_path) await context.supabase.storage.from("pricelists").remove([s.file_path]);
    return { ok: true };
  });
export const adminWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checked, allRows } = await import("@/server/submissions.server");
    if (
      !checked(await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }))
    )
      throw new Error("Forbidden");
    const [submissions, tickets, entities, users] = await Promise.all([
      allRows((a, b) =>
        context.supabase
          .from("submissions")
          .select("*")
          .in("status", ["in_review", "approved", "needs_pricing", "submitted", "rejected"])
          .order("submitted_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        context.supabase
          .from("tickets")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      context.supabase.from("entities").select("*").order("sort_order").then(checked),
      context.supabase.rpc("admin_list_users").then(checked),
    ]);
    return { submissions, tickets, entities, users };
  });
export const workflowBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { tickets: 0, review: 0 };
    const [t, s] = await Promise.all([
      context.supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      context.supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_review"),
    ]);
    if (t.error || s.error) throw new Error("Could not load badges");
    return { tickets: t.count ?? 0, review: s.count ?? 0 };
  });
export const reviewDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { checked, allRows } = await import("@/server/submissions.server");
    if (
      !checked(await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }))
    )
      throw new Error("Forbidden");
    return {
      submission: checked(
        await context.supabase.from("submissions").select("*").eq("id", data.id).single(),
      ),
      outputs: await allRows((a, b) =>
        context.supabase
          .from("output_rows")
          .select("*")
          .eq("submission_id", data.id)
          .order("entity_code")
          .order("row_no")
          .order("id")
          .range(a, b),
      ),
    };
  });
export const ticketSamples = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { checked } = await import("@/server/submissions.server");
    if (
      !checked(await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }))
    )
      throw new Error("Forbidden");
    const t = checked(
      await context.supabase.from("tickets").select("*").eq("id", data.id).single(),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("submission_rows")
      .select("item_code,description,cost_price,sub_activity")
      .eq("submission_id", t.submission_id ?? "")
      .eq("entity_code", t.entity_code ?? "");
    if (t.sub_activity !== null) q = q.eq("sub_activity", t.sub_activity);
    return checked(await q.order("row_no").limit(5));
  });
export const previewTicketFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ticketSchema)
  .handler(async ({ data, context }) => {
    const { checked, previewTicket } = await import("@/server/submissions.server");
    if (
      !checked(await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }))
    )
      throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return previewTicket(supabaseAdmin, data);
  });
export const resolveTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ticketSchema)
  .handler(async ({ data, context }) => {
    const { checked, allRows, runProcessing } = await import("@/server/submissions.server");
    if (
      !checked(await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }))
    )
      throw new Error("Forbidden");
    const t = checked(
      await context.supabase.from("tickets").select("*").eq("id", data.id).single(),
    );
    if (t.status !== "open" || !t.brand_activity || !t.entity_code)
      throw new Error("Ticket is no longer open");
    if (t.kind === "pricing_rule") {
      const sub = data.allSubs ? null : t.sub_activity;
      let q = context.supabase
        .from("pricing_rules")
        .select("id")
        .eq("brand_activity", t.brand_activity)
        .eq("entity_code", t.entity_code);
      q = sub === null ? q.is("sub_activity", null) : q.eq("sub_activity", sub);
      const old = checked(await q);
      const row = {
        brand_activity: t.brand_activity,
        entity_code: t.entity_code,
        sub_activity: sub,
        method: "calculate",
        source_entity: null,
        overhead_pct: data.overhead,
        margin_divisors: data.divisors,
        round_to: data.round,
        max_discount_pct: data.maxDiscount,
        compare_with_msrp: data.compare,
        active: true,
      };
      if (old[0])
        checked(await context.supabase.from("pricing_rules").update(row).eq("id", old[0].id));
      else checked(await context.supabase.from("pricing_rules").insert(row));
    } else if (t.kind === "exchange_rate") {
      if (!t.currency) throw new Error("Missing currency");
      checked(
        await context.supabase
          .from("exchange_rates")
          .upsert({ from_currency: t.currency, entity_code: t.entity_code, rate: data.rate }),
      );
    } else {
      if (!data.supplier.trim() || data.supplier.trim().toUpperCase() === "TO SET")
        throw new Error("Enter a supplier code");
      checked(
        await context.supabase
          .from("brand_suppliers")
          .upsert({
            brand_activity: t.brand_activity,
            entity_code: t.entity_code,
            supplier: data.supplier.trim(),
          }),
      );
    }
    const matching = await allRows((a, b) => {
      let q = context.supabase
        .from("tickets")
        .select("*")
        .eq("status", "open")
        .eq("kind", t.kind)
        .eq("entity_code", t.entity_code ?? "");
      if (t.kind !== "exchange_rate") q = q.eq("brand_activity", t.brand_activity ?? "");
      if (t.kind === "exchange_rate") q = q.eq("currency", t.currency ?? "");
      if (t.kind === "pricing_rule" && !data.allSubs)
        q =
          t.sub_activity === null
            ? q.is("sub_activity", null)
            : q.eq("sub_activity", t.sub_activity);
      return q.order("id").range(a, b);
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const failures: string[] = [];
    for (const id of [
      ...new Set(matching.map((t) => t.submission_id).filter((x): x is string => x !== null)),
    ]) {
      try {
        await runProcessing(supabaseAdmin, id);
        checked(
          await supabaseAdmin
            .from("tickets")
            .update({ resolved_by: context.userId })
            .eq("submission_id", id)
            .eq("status", "resolved"),
        );
      } catch {
        failures.push(id);
      }
    }
    return { affected: matching.length, failures };
  });
export const reviewAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    idSchema.extend({
      action: z.enum(["approve", "reject"]),
      comment: z.string().default(""),
      path: z.string().default(""),
      revision: z.number().int(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { checked } = await import("@/server/submissions.server");
    if (
      !checked(await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }))
    )
      throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "approve") {
      checked(await context.supabase.storage.from("erp-outputs").download(data.path));
      checked(
        await supabaseAdmin.rpc("approve_submission", {
          _id: data.id,
          _actor: context.userId,
          _revision: data.revision,
          _path: data.path,
        }),
      );
    } else {
      if (!data.comment.trim()) throw new Error("A rejection comment is required");
      checked(
        await context.supabase
          .from("submissions")
          .update({
            status: "rejected",
            review_comment: data.comment.trim(),
            reviewed_by: context.userId,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", data.id)
          .eq("status", "in_review")
          .eq("processing_revision", data.revision)
          .select("id")
          .single(),
      );
    }
    return { ok: true };
  });
