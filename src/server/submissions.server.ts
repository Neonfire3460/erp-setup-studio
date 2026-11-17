import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  processSubmission,
  type ProcessContext,
  type SubmissionSheet,
  type ErpLookup,
} from "./shared/processing";
import { asChecks, jsonValue, type TicketDraft } from "@/lib/workflow";
type DB = SupabaseClient<Database>;
export function checked<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Not found");
  return data as NonNullable<T>;
}
export async function allRows<T>(
  fetcher: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = checked(await fetcher(offset, offset + 499));
    out.push(...rows);
    if (rows.length < 500) return out;
  }
}
export async function loadProcessing(db: DB, id: string) {
  const s = checked(await db.from("submissions").select("*").eq("id", id).single());
  const [rows, entities, rules, rates, suppliers, brand, settings] = await Promise.all([
    allRows((a, b) =>
      db
        .from("submission_rows")
        .select("*")
        .eq("submission_id", id)
        .order("row_no")
        .order("id")
        .range(a, b),
    ),
    db.from("entities").select("*").order("sort_order").then(checked),
    db
      .from("pricing_rules")
      .select("*")
      .eq("brand_activity", s.brand_activity)
      .eq("active", true)
      .then(checked),
    db.from("exchange_rates").select("*").then(checked),
    db.from("brand_suppliers").select("*").eq("brand_activity", s.brand_activity).then(checked),
    db.from("brands").select("*").eq("brand_activity", s.brand_activity).single().then(checked),
    db.from("app_settings").select("*").then(checked),
  ]);
  const erpRows: Database["public"]["Tables"]["erp_items"]["Row"][] = [];
  const codes = [...new Set(rows.map((r) => r.item_code.trim().toUpperCase()))];
  for (let i = 0; i < codes.length; i += 100)
    erpRows.push(
      ...(await allRows((a, b) =>
        db
          .rpc("active_erp_for_codes", { _codes: codes.slice(i, i + 100) })
          .order("entity_code")
          .order("item_code")
          .range(a, b),
      )),
    );
  const lookup = new Map<string, Map<string, ErpLookup>>();
  for (const r of erpRows) {
    const item: ErpLookup = {
      measurementUnit: r.measurement_unit ?? "",
      retailPrice: r.retail_price,
      familyCode: r.family_code ?? "",
      groupCode: r.group_code ?? "",
      categoryCode: r.category_code ?? "",
      subCategoryCode: r.sub_category_code ?? "",
      midwichFamilyCode: r.midwich_family_code ?? "",
      familyName: r.family_name ?? "",
      groupName: r.group_name ?? "",
      categoryName: r.category_name ?? "",
      subCategoryName: r.sub_category_name ?? "",
      midwichFamilyName: r.midwich_family_name ?? "",
      maxDiscountPct: r.max_discount_pct,
      inactive: r.inactive,
      webactive: r.webactive,
      b2b: r.b2b,
    };
    const key = r.item_code.trim().toUpperCase();
    const m = lookup.get(key) ?? new Map();
    m.set(r.entity_code, item);
    lookup.set(key, m);
  }
  const setting = (key: string, fallback: number) => {
    const v = settings.find((s) => s.key === key)?.value;
    return typeof v === "number" ? v : fallback;
  };
  const ctx: ProcessContext = {
    brandActivity: s.brand_activity,
    entities: Object.fromEntries(
      entities.map((e) => [
        e.code,
        { code: e.code, name: e.name, currency: e.currency, sortOrder: e.sort_order },
      ]),
    ),
    rules: rules.map((r) => ({
      brandActivity: r.brand_activity,
      subActivity: r.sub_activity,
      entityCode: r.entity_code,
      method: r.method as "calculate" | "same_as_entity",
      sourceEntity: r.source_entity,
      overheadPct: r.overhead_pct,
      marginDivisors: r.margin_divisors,
      roundTo: r.round_to,
      maxDiscountPct: r.max_discount_pct,
      compareWithMsrp: r.compare_with_msrp,
    })),
    rates: Object.fromEntries(rates.map((r) => [`${r.from_currency}>${r.entity_code}`, r.rate])),
    suppliers: Object.fromEntries(suppliers.map((r) => [r.entity_code, r.supplier])),
    brandDefaultUnit: brand.default_unit,
    defaults: {
      inactive: setting("default_inactive", 0),
      webactive: setting("default_webactive", 0),
      b2b: setting("default_b2b", 0),
    },
    retailChangeWarnPct: setting("retail_change_warn_pct", 20),
    erp: (entity, code) => {
      const m = lookup.get(code.trim().toUpperCase());
      const same = m?.get(entity);
      if (same) return { item: same, sameEntity: true };
      for (const e of entities) {
        const other = m?.get(e.code);
        if (other) return { item: other, sameEntity: false };
      }
      return null;
    },
  };
  const sheets: SubmissionSheet[] = [];
  for (const r of rows) {
    if (r.cost_price === null || !Number.isFinite(r.cost_price) || r.cost_price < 0)
      throw new Error("Invalid submitted cost");
    let sheet = sheets.find((x) => x.entityCode === r.entity_code);
    if (!sheet) {
      sheet = { entityCode: r.entity_code, costCurrency: r.cost_currency, rows: [] };
      sheets.push(sheet);
    }
    sheet.rows.push({
      row: r.row_no,
      itemCode: r.item_code,
      alternativeCode: r.alternative_code ?? "",
      description: r.description ?? "",
      alternateDescription: r.alternate_description ?? "",
      brandActivity: r.brand_activity ?? s.brand_activity,
      subActivity: r.sub_activity ?? "",
      costPrice: r.cost_price,
      measurementUnit: r.measurement_unit ?? "",
      vendorMsrp: r.vendor_msrp,
    });
  }
  return { s, rows, sheets, ctx };
}
export async function runProcessing(db: DB, id: string) {
  const { s, rows, sheets, ctx } = await loadProcessing(db, id);
  if (s.status === "approved") throw new Error("Approved submissions are locked");
  const result = processSubmission(sheets, ctx);
  for (const o of result.outputs) {
    const original = rows.find((r) => r.entity_code === o.entityCode && r.row_no === o.row);
    o.checks.push(
      ...asChecks(original?.checks).filter((c) => !o.checks.some((x) => x.code === c.code)),
    );
  }
  const counts = {
    rows: result.outputs.length,
    entities: Object.fromEntries(sheets.map((s) => [s.entityCode, s.rows.length])),
    errors: result.outputs.filter((o) => o.checks.some((c) => c.level === "error")).length,
    warnings: result.outputs.filter((o) => o.checks.some((c) => c.level === "warning")).length,
    tickets: result.tickets.length,
  };
  checked(
    await db.rpc("persist_submission_processing", {
      _id: id,
      _revision: s.processing_revision,
      _status: result.status,
      _counts: jsonValue(counts),
      _outputs: jsonValue(result.outputs),
      _tickets: jsonValue(result.tickets),
    }),
  );
  return { status: result.status, counts };
}
export async function previewTicket(db: DB, d: TicketDraft) {
  const t = checked(await db.from("tickets").select("*").eq("id", d.id).single());
  if (!t.submission_id) throw new Error("Missing submission");
  const { sheets, ctx } = await loadProcessing(db, t.submission_id);
  const sample = sheets
    .filter((s) => s.entityCode === t.entity_code)
    .map((s) => ({
      ...s,
      rows: s.rows
        .filter((r) => t.sub_activity === null || r.subActivity === t.sub_activity)
        .slice(0, 5),
    }));
  ctx.rules = ctx.rules.filter(
    (r) =>
      !(r.entityCode === t.entity_code && r.subActivity === (d.allSubs ? null : t.sub_activity)),
  );
  ctx.rules.push({
    brandActivity: t.brand_activity ?? "",
    subActivity: d.allSubs ? null : t.sub_activity,
    entityCode: t.entity_code ?? "",
    method: "calculate",
    sourceEntity: null,
    overheadPct: d.overhead,
    marginDivisors: d.divisors,
    roundTo: d.round,
    maxDiscountPct: d.maxDiscount,
    compareWithMsrp: d.compare,
  });
  return processSubmission(sample, ctx).outputs;
}
