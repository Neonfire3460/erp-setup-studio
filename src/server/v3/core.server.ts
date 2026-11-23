// core.server.ts: shared backend helpers for NMK Unite v3 (service role, server only).
// Roles, settings, the ticket context (ERP data, rules, rates, suppliers) and ticket persistence.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database, Json } from "@/integrations/supabase/types";
import { rowToErpItem, type ErpItem } from "@/lib/nmk/erp";
import type { CategoryRow } from "@/lib/nmk/categories";
import type { FxRate, PricingRule, Breakdown } from "@/lib/nmk/pricing";
import type {
  Entity,
  Region,
  TicketDraft,
  TicketLine,
  NewItemFields,
  SupplierAnswer,
  TicketEntity,
} from "@/lib/nmk/types";
import type { TicketContext, TicketRow, ErpValues, RowFlag } from "@/lib/nmk/ticket";

export type DB = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];
export type TicketRecord = Tables["ir_tickets"]["Row"];
export type Role = "admin" | "reviewer" | "approver" | "user";

export async function adminDb(): Promise<DB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function ok<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error("Not found");
  return data as NonNullable<T>;
}

/** Reads every row of a query, 1,000 at a time. */
export async function allRows<T>(
  fetch: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let at = 0; ; at += 1000) {
    const rows = ok(await fetch(at, at + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/** The site address for links in emails, from the current request. */
export function siteOrigin() {
  try {
    return new URL(getRequest()?.url ?? "").origin;
  } catch {
    return "";
  }
}

export const json = <T>(v: T) => JSON.parse(JSON.stringify(v)) as Json;
export const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------- Roles ----------

export async function rolesOf(db: DB, userId: string): Promise<Role[]> {
  const r = ok(await db.from("user_roles").select("role").eq("user_id", userId));
  return r.map((x) => x.role as Role);
}

/** Admin can do everything. Reviewer: review, upload, ERP import. Approver: approval. */
export async function requireRole(db: DB, userId: string, need: Role[]) {
  const roles = await rolesOf(db, userId);
  if (roles.includes("admin") || need.some((n) => roles.includes(n))) return roles;
  throw new Error("You don't have access to this page");
}
export const STAFF: Role[] = ["admin", "reviewer", "approver"];

// ---------- Settings ----------

export async function loadSettings(db: DB) {
  const rows = ok(await db.from("app_settings").select("key,value"));
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const str = (k: string, d = "") => {
    const v = m.get(k);
    return typeof v === "string" ? v : d;
  };
  const num = (k: string, d: number) => {
    const v = Number(m.get(k));
    return Number.isFinite(v) ? v : d;
  };
  const bool = (k: string, d: boolean) => {
    const v = m.get(k);
    return typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : d;
  };
  const enabled = (m.get("emails_enabled") ?? {}) as Record<string, boolean>;
  return {
    adminInbox: str("admin_inbox"),
    testMode: bool("email_test_mode", true),
    testAddress: str("email_test_address"),
    emailFrom: str("email_from", "NMK Unite <onboarding@resend.dev>"),
    emailsEnabled: (kind: string) => enabled[kind] !== false,
    warnPct: num("price_change_warn_pct", 10),
    holdCommentRequired: bool("hold_comment_required", true),
    blockSelfApproval: bool("block_self_approval", false),
    pdfConfidentialLine: str("pdf_confidential_line"),
    pdfNoticeLine: str("pdf_notice_line"),
  };
}
export type Settings = Awaited<ReturnType<typeof loadSettings>>;

// ---------- Lists ----------

export const regionOf = (r: string): Region => (/south|sea/i.test(r) ? "SEA" : "ME");

export async function loadEntities(db: DB): Promise<
  (Entity & {
    legalName: string;
    pdfAllowed: boolean;
    pdfTermsLine: string;
    pdfLogoPath: string | null;
    active: boolean;
  })[]
> {
  const rows = ok(
    await db
      .from("entities")
      .select(
        "code,name,region,currency,is_master,sort_order,legal_name,pdf_allowed,pdf_terms_line,pdf_logo_path,active",
      )
      .order("sort_order"),
  );
  return rows.map((e) => ({
    code: e.code,
    name: e.name,
    region: regionOf(e.region),
    currency: e.currency,
    isMaster: e.is_master,
    sortOrder: e.sort_order,
    legalName: e.legal_name,
    pdfAllowed: e.pdf_allowed,
    pdfTermsLine: e.pdf_terms_line,
    pdfLogoPath: e.pdf_logo_path,
    active: e.active,
  }));
}

export function masterOf(entities: Entity[], region: Region) {
  return (
    entities.find((e) => e.region === region && e.isMaster)?.code ??
    (region === "ME" ? "001" : "012")
  );
}

export async function loadCategories(db: DB): Promise<CategoryRow[]> {
  const [cats, mw] = await Promise.all([
    allRows<Tables["categories"]["Row"]>((a, b) =>
      db.from("categories").select("*").eq("active", true).order("sub_category_code").range(a, b),
    ),
    db.from("midwich_families").select("code,name").then(ok),
  ]);
  const mwName = new Map(mw.map((m) => [m.code, m.name]));
  return cats.map((c) => ({
    familyCode: c.family_code,
    familyName: c.family_name,
    groupCode: c.group_code,
    groupName: c.group_name,
    categoryCode: c.category_code,
    categoryName: c.category_name,
    subCategoryCode: c.sub_category_code,
    midwichCode: c.midwich_code,
    midwichName: mwName.get(c.midwich_code) ?? "",
    reviewNote: c.review_note,
  }));
}

/** The brand's items in the active ERP data of one entity. */
export async function loadBrandErp(db: DB, entityCode: string, brand: string): Promise<ErpItem[]> {
  const rows = await allRows<Tables["erp_items"]["Row"]>(
    (a, b) =>
      db
        .from("erp_items_active")
        .select("*")
        .eq("entity_code", entityCode)
        .ilike("brand_activity", likeExact(brand))
        .order("item_code")
        .range(a, b) as never,
  );
  return rows.map((r) => rowToErpItem(r));
}

export async function loadRules(db: DB, brand: string): Promise<PricingRule[]> {
  const rows = ok(
    await db
      .from("pricing_rules")
      .select("*")
      .ilike("brand_activity", likeExact(brand))
      .eq("active", true),
  );
  return rows.map((r) => ({
    brand: r.brand_activity,
    entityCode: r.entity_code,
    subActivity: r.sub_activity,
    overheadPct: Number(r.overhead_pct),
    marginDivisors: (r.margin_divisors ?? []).map(Number),
    roundTo: Number(r.round_to),
    maxDiscount: r.max_discount_pct === null ? null : Number(r.max_discount_pct),
    active: r.active,
  }));
}

export async function loadFx(db: DB): Promise<FxRate[]> {
  return ok(await db.from("fx_rates").select("from_currency,to_currency,rate")).map((r) => ({
    from: r.from_currency,
    to: r.to_currency,
    rate: Number(r.rate),
  }));
}

/** Everything buildTicketRows needs, read with the service role (confidential tables). */
export async function loadTicketContext(
  db: DB,
  brand: string,
  region: Region,
  entityCodes: string[],
  settings: Settings,
) {
  const entities = await loadEntities(db);
  const master = masterOf(entities, region);
  const codes = [...new Set([master, ...entityCodes])];
  const [erpLists, categories, rules, fx, suppliers, units, brandRow, approved] = await Promise.all(
    [
      Promise.all(codes.map((c) => loadBrandErp(db, c, brand))),
      loadCategories(db),
      loadRules(db, brand),
      loadFx(db),
      db.from("brand_suppliers").select("*").ilike("brand_activity", likeExact(brand)).then(ok),
      db.from("units").select("code,name").eq("active", true).then(ok),
      db
        .from("brands")
        .select("*")
        .ilike("brand_activity", likeExact(brand))
        .maybeSingle()
        .then((r) => r.data),
      allRows<Tables["approved_prices"]["Row"]>((a, b) =>
        db
          .from("approved_prices")
          .select("*")
          .ilike("brand_activity", likeExact(brand))
          .in("entity_code", entityCodes)
          .range(a, b),
      ),
    ],
  );
  const erp: Record<string, ErpItem[]> = {};
  codes.forEach((c, i) => {
    if (erpLists[i]!.length) erp[c] = erpLists[i]!;
  });
  const approvedRetail: Record<string, Record<string, number>> = {};
  for (const a of approved)
    if (a.retail_price !== null)
      (approvedRetail[a.entity_code] ??= {})[a.item_code.toUpperCase()] = Number(a.retail_price);
  const ctx: TicketContext = {
    entities,
    masterEntity: master,
    erp,
    categories,
    rules,
    fx,
    suppliers: suppliers.map((s) => ({
      brand: s.brand_activity,
      entityCode: s.entity_code,
      supplierCode: s.supplier,
      supplierName: s.supplier_name,
    })),
    units,
    brandDefaults: {
      maxDiscount: brandRow?.default_max_discount ?? null,
      unit: brandRow?.default_unit ?? null,
    },
    approvedRetail,
    warnPct: settings.warnPct,
  };
  return { ctx, entities, master };
}

// ---------- Ticket <-> draft ----------

export const asDraft = (v: Json | null): TicketDraft | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as unknown as TicketDraft) : null;

/** Rebuilds the wizard answers from a submitted ticket (recalculation, resubmit). */
export async function draftFromTicket(db: DB, t: TicketRecord): Promise<TicketDraft> {
  const items = ok(
    await db.from("ir_ticket_items").select("*").eq("ticket_id", t.id).order("line_no"),
  );
  const lines: TicketLine[] = items.map((i) => ({
    lineNo: i.line_no,
    itemCode: i.item_code,
    altCode: i.alt_code,
    description: i.description,
    altDescription: i.alt_description,
    cost: i.cost === null ? null : Number(i.cost),
    entityCosts: (i.entity_costs ?? {}) as Record<string, number | null>,
    priceOnRequest: i.price_on_request,
    isNew: i.is_new,
    include: i.include,
    useVendorDescription: i.use_vendor_description,
    ...(i.erp_description ? { erpDescription: i.erp_description } : {}),
    ...(i.new_item ? { newItem: i.new_item as unknown as NewItemFields } : {}),
    ...(i.source ? { source: i.source as NonNullable<TicketLine["source"]> } : {}),
  }));
  return {
    brand: t.brand_activity,
    region: t.region as Region,
    stdCurrency: t.std_currency,
    entities: (t.entities ?? []) as unknown as TicketEntity[],
    source: t.source as "ai" | "template",
    lines,
    suppliers: (t.suppliers ?? []) as unknown as SupplierAnswer[],
    specialInstructions: t.special_instructions,
  };
}

export const rowToDb = (ticketId: string, r: TicketRow) => ({
  ticket_id: ticketId,
  entity_code: r.entityCode,
  line_no: r.lineNo,
  item_code: r.itemCode,
  is_new: r.isNew,
  erp: json(r.erp),
  calc: r.calc ? json(r.calc) : null,
  current_retail: r.currentRetail,
  retail_change_pct: r.retailChangePct,
  flags: r.flags,
  names: json(r.names),
});

export const dbToRow = (r: Tables["ir_ticket_rows"]["Row"]): TicketRow & { id: string } => ({
  id: r.id,
  entityCode: r.entity_code,
  lineNo: r.line_no,
  itemCode: r.item_code,
  isNew: r.is_new,
  erp: r.erp as unknown as ErpValues,
  calc: r.calc as unknown as Breakdown | null,
  currentRetail: r.current_retail === null ? null : Number(r.current_retail),
  retailChangePct: r.retail_change_pct === null ? null : Number(r.retail_change_pct),
  flags: (r.flags ?? []) as RowFlag[],
  names: (r.names ?? {
    family: "",
    group: "",
    category: "",
    midwich: "",
    unit: "",
  }) as TicketRow["names"],
});

export async function ticketRows(db: DB, ticketId: string) {
  const rows = await allRows<Tables["ir_ticket_rows"]["Row"]>((a, b) =>
    db
      .from("ir_ticket_rows")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("entity_code")
      .order("line_no")
      .range(a, b),
  );
  return rows.map(dbToRow);
}

export async function insertChunks<T>(
  db: DB,
  table: "ir_ticket_rows" | "ir_ticket_items",
  rows: T[],
) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await db.from(table).insert(rows.slice(i, i + 500) as never);
    if (r.error) throw new Error(r.error.message);
  }
}

export async function loadTicket(db: DB, id: string) {
  return ok(await db.from("ir_tickets").select("*").eq("id", id).single());
}

/** Status change through the database function (checks the current status, logs the event). */
export async function transition(
  db: DB,
  id: string,
  actor: string,
  from: string[],
  to: string,
  action: string,
  opts: { comment?: string | null; internal?: boolean; patch?: Record<string, unknown> } = {},
) {
  const r = await db.rpc("ir_transition", {
    _ticket: id,
    _actor: actor,
    _from: from,
    _to: to,
    _action: action,
    _comment: opts.comment ?? undefined,
    _internal: opts.internal ?? false,
    _patch: json(opts.patch ?? {}),
  } as never);
  if (r.error) throw new Error(r.error.message);
  return r.data as unknown as TicketRecord;
}

export async function people(db: DB, ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map<string, { email: string; name: string }>();
  const rows = ok(await db.from("profiles").select("id,email,full_name").in("id", list));
  return new Map(rows.map((p) => [p.id, { email: p.email, name: p.full_name || p.email }]));
}

export async function emailsWithRole(db: DB, role: Role) {
  const r = ok(
    await db
      .from("user_roles")
      .select("user_id")
      .eq("role", role as never),
  );
  const p = await people(
    db,
    r.map((x) => x.user_id),
  );
  return [...p.values()].map((x) => x.email).filter(Boolean);
}
