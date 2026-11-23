// wizard.functions.ts: Standard Item Registration (brand manager side) and My Submissions.
// Costs, rates, overheads and margins never come back to the browser from here, except the
// brand's own old ERP cost in the Price check (the plan's Step 3).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { draftSchema, idSchema } from "./schemas";
import type { TicketDraft } from "@/lib/nmk/types";

export const wizardOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ok } = await import("@/server/v3/core.server");
    const db = context.supabase;
    const [brands, entities, currencies, units, categories, midwich] = await Promise.all([
      db.rpc("list_brands_v3").then(ok),
      db
        .from("entities")
        .select("code,name,region,currency,is_master,sort_order")
        .eq("active", true)
        .order("sort_order")
        .then(ok),
      db.from("currencies").select("code,name").eq("active", true).order("sort_order").then(ok),
      db.from("units").select("code,name").eq("active", true).order("sort_order").then(ok),
      db
        .from("categories")
        .select(
          "family_code,family_name,group_code,group_name,category_code,category_name,sub_category_code,midwich_code",
        )
        .eq("active", true)
        .order("family_code")
        .order("group_code")
        .order("category_code")
        .limit(5000)
        .then(ok),
      db.from("midwich_families").select("code,name").order("code").then(ok),
    ]);
    return { brands, entities, currencies, units, categories, midwich };
  });

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ok } = await import("@/server/v3/core.server");
    return ok(
      await context.supabase
        .from("ir_tickets")
        .select(
          "id,ticket_no,brand_activity,entities,counts,status,step,submitted_at,created_at,updated_at,special_instructions,reject_reason,resubmit_of,decided_at,uploaded_at,verified_at",
        )
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(500),
    );
  });

export const getDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { ok } = await import("@/server/v3/core.server");
    const t = ok(
      await context.supabase
        .from("ir_tickets")
        .select("id,status,step,draft,user_id,resubmit_of")
        .eq("id", data.id)
        .single(),
    );
    if (t.user_id !== context.userId || t.status !== "draft")
      throw new Error("This draft is no longer open");
    return {
      id: t.id,
      step: t.step,
      draft: t.draft as unknown as TicketDraft | null,
      resubmitOf: t.resubmit_of,
    };
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().nullable(),
      step: z.number().int().min(1).max(7),
      draft: draftSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { ok, json } = await import("@/server/v3/core.server");
    const d = data.draft;
    const row = {
      brand_activity: d.brand || "(not picked)",
      region: d.region,
      std_currency: d.stdCurrency,
      entities: json(d.entities),
      source: d.source,
      step: data.step,
      draft: json(d),
      special_instructions: d.specialInstructions ?? "",
    };
    if (data.id) {
      const r = ok(
        await context.supabase
          .from("ir_tickets")
          .update(row)
          .eq("id", data.id)
          .eq("status", "draft")
          .select("id"),
      );
      if (!r.length) throw new Error("This draft is no longer open");
      return { id: data.id };
    }
    const r = ok(
      await context.supabase
        .from("ir_tickets")
        .insert({ ...row, user_id: context.userId, status: "draft" })
        .select("id")
        .single(),
    );
    return { id: r.id };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { ok } = await import("@/server/v3/core.server");
    ok(
      await context.supabase
        .from("ir_tickets")
        .delete()
        .eq("id", data.id)
        .eq("status", "draft")
        .select("id"),
    );
    return { ok: true };
  });

/** Option B "Pre-fill with this brand's current ERP items": active items of the region master. */
export const templatePrefill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ brand: z.string().min(1), region: z.enum(["ME", "SEA"]) }))
  .handler(async ({ data }) => {
    const { adminDb, loadEntities, masterOf, loadBrandErp } =
      await import("@/server/v3/core.server");
    const db = await adminDb();
    const master = masterOf(await loadEntities(db), data.region);
    const items = await loadBrandErp(db, master, data.brand);
    return items
      .filter((i) => i.inactive !== 1)
      .map((i) => ({
        itemCode: i.itemCode,
        altCode: i.altCode,
        description: i.description,
        altDescription: i.altDescription,
      }));
  });

/** Step 3: Price check against the region master (and entities with their own ERP data). */
export const priceCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ draft: draftSchema }))
  .handler(async ({ data }) => {
    const { adminDb, loadEntities, masterOf, loadBrandErp, loadSettings } =
      await import("@/server/v3/core.server");
    const { runPriceCheck } = await import("@/lib/nmk/priceCheck");
    const db = await adminDb();
    const d = data.draft as unknown as TicketDraft;
    const entities = await loadEntities(db);
    const master = masterOf(entities, d.region);
    const others = d.entities.map((e) => e.code).filter((c) => c !== master);
    const [masterItems, settings, ...otherItems] = await Promise.all([
      loadBrandErp(db, master, d.brand),
      loadSettings(db),
      ...others.map((c) => loadBrandErp(db, c, d.brand)),
    ]);
    const erpByEntity: Record<string, Awaited<ReturnType<typeof loadBrandErp>>> = {};
    others.forEach((c, i) => {
      if (otherItems[i]!.length) erpByEntity[c] = otherItems[i]!;
    });
    const result = runPriceCheck({
      brand: d.brand,
      lines: d.lines,
      entities: d.entities,
      stdCurrency: d.stdCurrency,
      masterEntity: master,
      master: masterItems,
      erpByEntity,
      warnPct: settings.warnPct,
    });
    // For Step 4 suggestions only: codes and categories of the brand's items (no prices).
    const known = masterItems.map((i) => ({
      itemCode: i.itemCode,
      subCategoryCode: i.subCategoryCode,
      subActivity: i.subActivity,
    }));
    return { result, known };
  });

/** Step 5: the supplier the system has for this brand in each entity. */
export const supplierInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ brand: z.string().min(1), entities: z.array(z.string()).max(20) }))
  .handler(async ({ data }) => {
    const { adminDb, ok, likeExact, loadBrandErp } = await import("@/server/v3/core.server");
    const db = await adminDb();
    const rows = ok(
      await db
        .from("brand_suppliers")
        .select("*")
        .ilike("brand_activity", likeExact(data.brand))
        .in("entity_code", data.entities),
    );
    return Promise.all(
      data.entities.map(async (e) => {
        const s = rows.find((r) => r.entity_code === e);
        if (s?.supplier)
          return { entityCode: e, supplierCode: s.supplier, supplierName: s.supplier_name };
        // Fallback: the most common Supplier Code on the brand's ERP items in that entity.
        const items = await loadBrandErp(db, e, data.brand);
        const count = new Map<string, number>();
        for (const i of items)
          if (i.supplierCode) count.set(i.supplierCode, (count.get(i.supplierCode) ?? 0) + 1);
        const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
        return { entityCode: e, supplierCode: top, supplierName: s?.supplier_name ?? "" };
      }),
    );
  });

/** Step 7: Complete. Checks again, calculates every row with the admin formula, saves, sends 2 emails. */
export const submitTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid(), specialInstructions: z.string().max(4000).default("") }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { buildTicketRows, checkDraft, ticketLines } = await import("@/lib/nmk/ticket");
    const { runPriceCheck } = await import("@/lib/nmk/priceCheck");
    const { codeKey, isDemoCode } = await import("@/lib/nmk/util");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    const t = await core.loadTicket(db, data.id);
    if (t.user_id !== context.userId) throw new Error("This is not your ticket");
    if (t.status !== "draft") throw new Error("This ticket was already submitted");
    const d0 = core.asDraft(t.draft);
    if (!d0) throw new Error("The draft is empty");
    const d: TicketDraft = {
      ...d0,
      specialInstructions: data.specialInstructions,
      lines: d0.lines.filter((l) => !isDemoCode(l.itemCode)),
    };
    const settings = await core.loadSettings(db);
    const { ctx, master } = await core.loadTicketContext(
      db,
      d.brand,
      d.region,
      d.entities.map((e) => e.code),
      settings,
    );
    // New or existing is decided here from the master's ERP data, whatever the browser said.
    const masterCodes = new Set((ctx.erp[master] ?? []).map((i) => codeKey(i.itemCode)));
    d.lines = d.lines.map((l) => ({
      ...l,
      isNew: !masterCodes.has(codeKey(l.itemCode)),
      include: masterCodes.has(codeKey(l.itemCode)) ? true : l.include,
    }));
    const brand = core
      .ok(await db.rpc("list_brands_v3"))
      .find((b) => b.brand_activity.toUpperCase() === d.brand.toUpperCase());
    const missing = checkDraft(d, {
      units: ctx.units.map((u) => u.code),
      ...(brand?.sub_activities.length ? { subActivities: brand.sub_activities } : {}),
    });
    if (missing.length)
      throw new Error(
        `We can't submit this yet: ${missing.length} thing${missing.length === 1 ? " is" : "s are"} missing. ${missing
          .slice(0, 3)
          .map((m) => m.message)
          .join("; ")}`,
      );

    const built = buildTicketRows(d, ctx);
    const pc = runPriceCheck({
      brand: d.brand,
      lines: ticketLines(d),
      entities: d.entities,
      stdCurrency: d.stdCurrency,
      masterEntity: master,
      master: ctx.erp[master] ?? [],
      warnPct: settings.warnPct,
    });
    const tiles = pc.perEntity[0]?.tiles;
    const priceSummary = tiles
      ? {
          compared: tiles.compared,
          up: tiles.up,
          down: tiles.down,
          unchanged: tiles.unchanged,
          avgPct: tiles.avgPct,
          medianPct: tiles.medianPct,
          newCodes: pc.newCodes.length,
          missingFromList: pc.missing.length,
        }
      : null;

    // Rows first (a failed insert leaves the ticket in Draft), then the status change.
    await db.from("ir_ticket_items").delete().eq("ticket_id", t.id);
    await db.from("ir_ticket_rows").delete().eq("ticket_id", t.id);
    await core.insertChunks(
      db,
      "ir_ticket_items",
      ticketLines(d).map((l) => ({
        ticket_id: t.id,
        line_no: l.lineNo,
        item_code: l.itemCode,
        alt_code: l.altCode,
        description: l.description,
        alt_description: l.altDescription,
        cost: l.cost,
        entity_costs: core.json(l.entityCosts),
        price_on_request: l.priceOnRequest,
        is_new: l.isNew,
        include: l.include,
        use_vendor_description: l.useVendorDescription,
        erp_description: l.erpDescription ?? null,
        new_item: l.newItem ? core.json(l.newItem) : null,
        source: l.source ? core.json(l.source) : null,
      })),
    );
    await core.insertChunks(
      db,
      "ir_ticket_rows",
      built.rows.map((r) => core.rowToDb(t.id, r)),
    );
    const done = await core.transition(db, t.id, context.userId, ["draft"], "submitted", "submit", {
      comment: data.specialInstructions || null,
      patch: {
        special_instructions: data.specialInstructions,
        suppliers: d.suppliers,
        counts: built.counts,
        price_summary: priceSummary,
        missing_setup: built.missingSetup,
      },
    });
    await db
      .from("brands")
      .update({ last_currency: d.stdCurrency })
      .ilike("brand_activity", core.likeExact(d.brand));

    const who = (await core.people(db, [context.userId])).get(context.userId);
    const facts = mail.ticketFacts(done, who?.name ?? "");
    const site = core.siteOrigin();
    const link = `${site}/review/${t.id}`;
    await mail.sendEmail(db, settings, {
      kind: "submitted_admin",
      ticketId: t.id,
      to: [settings.adminInbox],
      subject: `New ticket ${done.ticket_no}: ${d.brand}`,
      html: mail.layout(`New ticket ${done.ticket_no}`, facts, {
        href: link,
        label: "Open the Review page",
      }),
    });
    await mail.sendEmail(db, settings, {
      kind: "submitted_user",
      ticketId: t.id,
      to: [who?.email ?? ""],
      subject: `Your submission ${done.ticket_no}: ${d.brand}`,
      html: mail.layout(`We received ${done.ticket_no}`, facts, {
        href: `${site}/my-submissions/${t.id}`,
        label: "View your submission",
      }),
    });
    return { id: t.id, ticketNo: done.ticket_no };
  });

/** Read-only ticket view for its owner: words only, no ERP file or retail workings. */
export const myTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const { ok } = await import("@/server/v3/core.server");
    const db = context.supabase;
    const t = ok(
      await db
        .from("ir_tickets")
        .select(
          "id,user_id,ticket_no,brand_activity,region,std_currency,entities,suppliers,counts,price_summary,status,special_instructions,reject_reason,submitted_at,created_at,decided_at,uploaded_at,verified_at,resubmit_of",
        )
        .eq("id", data.id)
        .single(),
    );
    if (t.user_id !== context.userId) throw new Error("This is not your ticket");
    const [items, events] = await Promise.all([
      db
        .from("ir_ticket_items")
        .select(
          "line_no,item_code,alt_code,description,alt_description,cost,entity_costs,price_on_request,is_new,use_vendor_description,new_item",
        )
        .eq("ticket_id", data.id)
        .order("line_no")
        .limit(20000)
        .then(ok),
      db
        .from("ir_ticket_events")
        .select("action,to_status,comment,at,internal")
        .eq("ticket_id", data.id)
        .eq("internal", false)
        .order("at")
        .then(ok),
    ]);
    return { ticket: t, items, events };
  });

/** Rejected ticket -> a new draft with the same answers, so the brand manager only fixes what's wrong. */
export const resubmitTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    const t = await core.loadTicket(db, data.id);
    if (t.user_id !== context.userId) throw new Error("This is not your ticket");
    if (t.status !== "rejected") throw new Error("Only rejected tickets can be resubmitted");
    const d = await core.draftFromTicket(db, t);
    const r = core.ok(
      await context.supabase
        .from("ir_tickets")
        .insert({
          user_id: context.userId,
          status: "draft",
          brand_activity: d.brand,
          region: d.region,
          std_currency: d.stdCurrency,
          entities: core.json(d.entities),
          source: d.source,
          step: 2,
          draft: core.json(d),
          special_instructions: d.specialInstructions ?? "",
          resubmit_of: t.id,
        })
        .select("id")
        .single(),
    );
    return { id: r.id };
  });
