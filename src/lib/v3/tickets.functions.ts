// tickets.functions.ts: the admin side of a ticket. Reviewer (Review page, edits, Proceed, Reject,
// Upload page), Approver (Approve, Hold, Reject). Every status change goes through ir_transition.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { idSchema } from "./schemas";

const QUEUES = {
  review: ["submitted", "in_review", "on_hold"],
  approval: ["awaiting_approval"],
  upload: ["approved", "uploaded"],
  all: [
    "submitted",
    "in_review",
    "on_hold",
    "awaiting_approval",
    "approved",
    "uploaded",
    "verified",
    "rejected",
  ],
} as const;

export const staffQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ view: z.enum(["review", "approval", "upload", "all"]) }))
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(
      db,
      context.userId,
      data.view === "approval" ? ["approver"] : data.view === "all" ? core.STAFF : ["reviewer"],
    );
    const rows = core.ok(
      await db
        .from("ir_tickets")
        .select(
          "id,ticket_no,kind,needed_by,effective_from,incomplete,brand_activity,entities,counts,status,user_id,reviewer_id,approver_id,submitted_at,proceeded_at,decided_at,uploaded_at,uploads,cross_check,missing_setup,special_instructions,updated_at",
        )
        .in("status", [...QUEUES[data.view]])
        .order("submitted_at", { ascending: true })
        .limit(500),
    );
    const who = await core.people(
      db,
      rows.flatMap((r) => [r.user_id, r.reviewer_id, r.approver_id]),
    );
    return rows.map((r) => ({
      ...r,
      owner: who.get(r.user_id)?.name ?? "",
      reviewer: r.reviewer_id ? (who.get(r.reviewer_id)?.name ?? "") : "",
      approver: r.approver_id ? (who.get(r.approver_id)?.name ?? "") : "",
    }));
  });

/** Opens a ticket for the Review, Approval or Upload page. A reviewer opening a Submitted ticket starts the review. */
export const staffTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { missingSetupText } = await import("@/lib/nmk/ticket");
    const db = await core.adminDb();
    const roles = await core.requireRole(db, context.userId, core.STAFF);
    let t = await core.loadTicket(db, data.id);
    if (t.status === "draft") throw new Error("This ticket is still a draft");
    if (t.status === "submitted" && (roles.includes("reviewer") || roles.includes("admin")))
      t = await core.transition(
        db,
        t.id,
        context.userId,
        ["submitted"],
        "in_review",
        "start_review",
      );
    const [rows, events, edits, entities, settings] = await Promise.all([
      core.ticketRows(db, t.id),
      db.from("ir_ticket_events").select("*").eq("ticket_id", t.id).order("at").then(core.ok),
      db
        .from("ir_ticket_edits")
        .select("*")
        .eq("ticket_id", t.id)
        .order("at", { ascending: false })
        .limit(2000)
        .then(core.ok),
      core.loadEntities(db),
      core.loadSettings(db),
    ]);
    const who = await core.people(db, [
      t.user_id,
      t.reviewer_id,
      t.approver_id,
      ...events.map((e) => e.actor),
      ...edits.map((e) => e.actor),
    ]);
    const name = (id: string | null) => (id ? (who.get(id)?.name ?? "") : "");
    const missing = (t.missing_setup ?? []) as unknown as Parameters<typeof missingSetupText>[0][];
    return {
      ticket: t,
      roles,
      warnPct: settings.warnPct,
      holdCommentRequired: settings.holdCommentRequired,
      owner: name(t.user_id),
      ownerEmail: who.get(t.user_id)?.email ?? "",
      reviewer: name(t.reviewer_id),
      approver: name(t.approver_id),
      entities: entities.map((e) => ({ code: e.code, name: e.name, currency: e.currency })),
      rows,
      missing: missing.map((m) => ({ ...m, text: missingSetupText(m) })),
      events: events.map((e) => ({ ...e, actorName: name(e.actor) })),
      edits: edits.map((e) => ({ ...e, actorName: name(e.actor) })),
    };
  });

const EDITABLE = [
  "Supplier",
  "Alternative Code",
  "Description",
  "Alternate Description",
  "Det. Description",
  "Brand Activity",
  "Sub Activity",
  "Cost Price",
  "Retail Price",
  "Max Discount",
  "Family Name",
  "Group Name",
  "Category Name",
  "Sub Category Name",
  "Midwich Family",
  "Measurement Unit",
  "Inactive",
  "Webactive",
  "B2B",
  "Exchange rate",
  "Overhead %",
  "Margin divisor",
] as const;

/** Reviewer edits (one cell or a whole column fill). Cost, rate, overhead or divisor recalculate the row. Logged. */
export const editCells = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ticketId: z.string().uuid(),
      edits: z
        .array(
          z.object({
            rowId: z.string().uuid(),
            column: z.enum(EDITABLE),
            value: z.union([z.string(), z.number(), z.null()]),
          }),
        )
        .min(1)
        .max(5000),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { applyEdit } = await import("@/lib/nmk/ticket");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const t = await core.loadTicket(db, data.ticketId);
    if (!["in_review", "on_hold", "submitted"].includes(t.status))
      throw new Error(`This ticket is ${t.status.replace("_", " ")} and can't be edited`);
    const settings = await core.loadSettings(db);
    const ids = [...new Set(data.edits.map((e) => e.rowId))];
    const stored = core.ok(
      await db.from("ir_ticket_rows").select("*").eq("ticket_id", t.id).in("id", ids),
    );
    const rows = new Map(stored.map((r) => [r.id, core.dbToRow(r)]));
    const log: {
      ticket_id: string;
      row_id: string;
      entity_code: string;
      item_code: string;
      column_name: string;
      old_value: ReturnType<typeof core.json>;
      new_value: ReturnType<typeof core.json>;
      actor: string;
    }[] = [];
    const numeric = new Set([
      "Cost Price",
      "Retail Price",
      "Max Discount",
      "Inactive",
      "Webactive",
      "B2B",
      "Exchange rate",
      "Overhead %",
      "Margin divisor",
    ]);
    for (const e of data.edits) {
      const r = rows.get(e.rowId);
      if (!r) throw new Error("A row was not found. Reload the page.");
      let v = e.value;
      if (numeric.has(e.column) && v !== null && v !== "") {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`${e.column} must be a number`);
        v = n;
      }
      if (["Inactive", "Webactive", "B2B"].includes(e.column) && v !== 0 && v !== 1)
        throw new Error(`${e.column} must be 0 or 1`);
      if (e.column === "Margin divisor" && !(typeof v === "number" && v > 0 && v <= 1))
        throw new Error("Margin divisor must be more than 0 and at most 1");
      if (e.column === "Exchange rate" && !(typeof v === "number" && v > 0))
        throw new Error("Exchange rate must be more than 0");
      const old =
        e.column === "Exchange rate"
          ? (r.calc?.fx ?? null)
          : e.column === "Overhead %"
            ? (r.calc?.overheadPct ?? null)
            : e.column === "Margin divisor"
              ? (r.calc?.divisors[0] ?? null)
              : r.erp[e.column];
      const next = applyEdit(r, e.column, v, settings.warnPct);
      rows.set(e.rowId, { ...next, id: e.rowId });
      log.push({
        ticket_id: t.id,
        row_id: e.rowId,
        entity_code: r.entityCode,
        item_code: r.itemCode,
        column_name: e.column,
        old_value: core.json(old),
        new_value: core.json(v),
        actor: context.userId,
      });
    }
    for (const id of ids) {
      const r = rows.get(id)!;
      const u = core.rowToDb(t.id, r);
      core.ok(
        await db
          .from("ir_ticket_rows")
          .update({
            erp: u.erp,
            calc: u.calc,
            flags: u.flags,
            retail_change_pct: u.retail_change_pct,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("id"),
      );
    }
    for (let i = 0; i < log.length; i += 500)
      core.ok(
        await db
          .from("ir_ticket_edits")
          .insert(log.slice(i, i + 500))
          .select("id"),
      );
    return { rows: ids.map((id) => rows.get(id)!) };
  });

/** After Admin settings were fixed: recalculate the rows (rows the reviewer edited are kept) and the missing-setup list. */
export const recalcTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { buildTicketRows } = await import("@/lib/nmk/ticket");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const t = await core.loadTicket(db, data.id);
    if (!["in_review", "on_hold", "submitted"].includes(t.status))
      throw new Error("Only tickets under review can be recalculated");
    const settings = await core.loadSettings(db);
    const d = await core.draftFromTicket(db, t);
    const { ctx } = await core.loadTicketContext(
      db,
      d.brand,
      d.region,
      d.entities.map((e) => e.code),
      settings,
    );
    const built = buildTicketRows(d, ctx);
    const old = await core.ticketRows(db, t.id);
    const keep = new Set(
      old.filter((r) => r.flags.includes("edited")).map((r) => `${r.entityCode}|${r.lineNo}`),
    );
    const fresh = built.rows.filter((r) => !keep.has(`${r.entityCode}|${r.lineNo}`));
    for (const r of fresh) {
      const u = core.rowToDb(t.id, r);
      const o = old.find((x) => x.entityCode === r.entityCode && x.lineNo === r.lineNo);
      if (o)
        core.ok(
          await db
            .from("ir_ticket_rows")
            .update({
              erp: u.erp,
              calc: u.calc,
              flags: u.flags,
              current_retail: u.current_retail,
              retail_change_pct: u.retail_change_pct,
              names: u.names,
              updated_at: new Date().toISOString(),
            })
            .eq("id", o.id)
            .select("id"),
        );
      else core.ok(await db.from("ir_ticket_rows").insert(u).select("id"));
    }
    core.ok(
      await db
        .from("ir_tickets")
        .update({ missing_setup: core.json(built.missingSetup), counts: core.json(built.counts) })
        .eq("id", t.id)
        .select("id"),
    );
    await db.from("ir_ticket_events").insert({
      ticket_id: t.id,
      action: "recalculate",
      from_status: t.status,
      to_status: t.status,
      actor: context.userId,
      internal: true,
      comment: `${fresh.length} rows recalculated, ${keep.size} edited rows kept`,
    });
    return { recalculated: fresh.length, kept: keep.size, missing: built.missingSetup.length };
  });

export const proceedTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const t = await core.loadTicket(db, data.id);
    const missing = (t.missing_setup ?? []) as unknown[];
    if (missing.length)
      throw new Error(
        "Proceed is blocked: add the missing setup in Admin settings, then press Recalculate",
      );
    const rows = await core.ticketRows(db, t.id);
    const blocked = rows.filter(
      (r) =>
        r.erp["Retail Price"] === null ||
        r.flags.some(
          (f) =>
            f === "missing_rule" ||
            f === "missing_fx" ||
            f === "missing_supplier" ||
            f === "missing_category",
        ),
    );
    if (blocked.length)
      throw new Error(
        `Proceed is blocked: ${blocked.length} rows still have no retail price or miss a setting`,
      );
    const done = await core.transition(
      db,
      t.id,
      context.userId,
      ["submitted", "in_review", "on_hold"],
      "awaiting_approval",
      "proceed",
    );
    const settings = await core.loadSettings(db);
    const approvers = await core.emailsWithRole(db, "approver");
    const owner = (await core.people(db, [t.user_id])).get(t.user_id);
    await mail.sendEmail(db, settings, {
      kind: "awaiting_approval",
      ticketId: t.id,
      to: approvers.length ? approvers : [settings.adminInbox],
      subject: `${done.ticket_no} is awaiting your approval`,
      html: mail.layout(
        `${done.ticket_no} is awaiting your approval`,
        mail.ticketFacts(done, owner?.name ?? ""),
        { href: `${core.siteOrigin()}/approval/${t.id}`, label: "Open the Approval page" },
      ),
    });
    return { status: done.status };
  });

export const rejectTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      reason: z.string().trim().min(3, "A reason is required").max(2000),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    const t = await core.loadTicket(db, data.id);
    await core.requireRole(
      db,
      context.userId,
      t.status === "awaiting_approval" ? ["approver"] : ["reviewer"],
    );
    const done = await core.transition(
      db,
      t.id,
      context.userId,
      ["submitted", "in_review", "on_hold", "awaiting_approval"],
      "rejected",
      "reject",
      { comment: data.reason },
    );
    const settings = await core.loadSettings(db);
    const owner = (await core.people(db, [t.user_id])).get(t.user_id);
    await mail.sendEmail(db, settings, {
      kind: "rejected_user",
      ticketId: t.id,
      to: [owner?.email ?? ""],
      subject: `${done.ticket_no} was rejected`,
      html: mail.layout(
        `${done.ticket_no} was rejected`,
        [["Reason", data.reason], ...mail.ticketFacts(done, owner?.name ?? "")],
        { href: `${core.siteOrigin()}/my-submissions/${t.id}`, label: "Open and resubmit" },
      ),
    });
    return { status: done.status };
  });

export const holdTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), comment: z.string().trim().max(2000) }))
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["approver"]);
    const settings = await core.loadSettings(db);
    if (settings.holdCommentRequired && data.comment.length < 3)
      throw new Error("Please add comments for the reviewer");
    const t = await core.loadTicket(db, data.id);
    const done = await core.transition(
      db,
      t.id,
      context.userId,
      ["awaiting_approval"],
      "on_hold",
      "hold",
      { comment: data.comment, internal: true },
    );
    const p = await core.people(db, [t.user_id, t.reviewer_id]);
    const facts = mail.ticketFacts(done, p.get(t.user_id)?.name ?? "");
    await mail.sendEmail(db, settings, {
      kind: "hold_reviewer",
      ticketId: t.id,
      to: [(t.reviewer_id && p.get(t.reviewer_id)?.email) || settings.adminInbox],
      subject: `${done.ticket_no} is on hold`,
      html: mail.layout(
        `${done.ticket_no} is on hold`,
        [["Approver's comments", data.comment], ...facts],
        { href: `${core.siteOrigin()}/review/${t.id}`, label: "Open the Review page" },
      ),
    });
    await mail.sendEmail(db, settings, {
      kind: "hold_user",
      ticketId: t.id,
      to: [p.get(t.user_id)?.email ?? ""],
      subject: `${done.ticket_no} is on hold for a check`,
      html: mail.layout(`${done.ticket_no} is on hold for a check`, [
        "The admin team is checking a few details. You don't need to do anything.",
        ...facts,
      ]),
    });
    return { status: done.status };
  });

/** Approve: status, approved prices for PDFs, emails to the user and to the reviewer with one Excel file per entity. */
export const approveTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const XLSX = await import("xlsx");
    const { buildErpWorkbook, erpFileName } = await import("@/lib/nmk/erpFile");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["approver"]);
    const settings = await core.loadSettings(db);
    const t0 = await core.loadTicket(db, data.id);
    if (settings.blockSelfApproval && t0.reviewer_id === context.userId)
      throw new Error("You reviewed this ticket, so another approver must approve it");
    const r = await db.rpc("ir_approve", { _ticket: data.id, _actor: context.userId });
    if (r.error) throw new Error(r.error.message);
    const t = await core.loadTicket(db, data.id);
    const [rows, entities] = await Promise.all([core.ticketRows(db, t.id), core.loadEntities(db)]);
    const codes = [...new Set(rows.map((x) => x.entityCode))];
    const attachments = codes.map((c) => {
      const name = entities.find((e) => e.code === c)?.name ?? c;
      const content = buildErpWorkbook(
        XLSX as never,
        [{ name, rows: rows.filter((x) => x.entityCode === c).map((x) => x.erp) }],
        "base64",
      ) as string;
      return { filename: erpFileName(t.ticket_no ?? "ticket", name, t.brand_activity), content };
    });
    const p = await core.people(db, [t.user_id, t.reviewer_id]);
    const facts = mail.ticketFacts(t, p.get(t.user_id)?.name ?? "");
    await mail.sendEmail(db, settings, {
      kind: "approved_user",
      ticketId: t.id,
      to: [p.get(t.user_id)?.email ?? ""],
      subject: `${t.ticket_no} is approved`,
      html: mail.layout(`${t.ticket_no} is approved`, [
        "It will be uploaded to the ERP shortly.",
        ...facts,
      ]),
    });
    await mail.sendEmail(db, settings, {
      kind: "approved_reviewer",
      ticketId: t.id,
      to: [(t.reviewer_id && p.get(t.reviewer_id)?.email) || settings.adminInbox],
      subject: `${t.ticket_no} approved: please upload to the ERP`,
      html: mail.layout(
        `${t.ticket_no} approved: go ahead and upload`,
        [`The ERP Excel file for each entity is attached (${attachments.length}).`, ...facts],
        { href: `${core.siteOrigin()}/upload`, label: "Open the Upload page" },
      ),
      attachments,
    });
    return { status: t.status };
  });

/** ERP rows per entity for the Upload page downloads (the browser builds the .xlsx). Staff only. */
export const ticketErpRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, core.STAFF);
    const [t, rows, entities] = await Promise.all([
      core.loadTicket(db, data.id),
      core.ticketRows(db, data.id),
      core.loadEntities(db),
    ]);
    const codes = [...new Set(rows.map((r) => r.entityCode))];
    return {
      ticketNo: t.ticket_no ?? "",
      brand: t.brand_activity,
      kind: t.kind,
      sheets: codes.map((c) => ({
        entityCode: c,
        name: entities.find((e) => e.code === c)?.name ?? c,
        rows: rows.filter((r) => r.entityCode === c).map((r) => r.erp),
      })),
    };
  });

/** Upload page: "Mark as uploaded" per entity. When every entity is done: Uploaded to ERP + email. */
export const markUploaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), entityCode: z.string() }))
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const t = await core.loadTicket(db, data.id);
    if (t.status !== "approved") throw new Error(`This ticket is ${t.status.replace("_", " ")}`);
    const ents = ((t.entities ?? []) as unknown as { code: string }[]).map((e) => e.code);
    if (!ents.includes(data.entityCode)) throw new Error("This entity is not in the ticket");
    const uploads = {
      ...((t.uploads ?? {}) as Record<string, unknown>),
      [data.entityCode]: { at: new Date().toISOString(), by: context.userId },
    };
    if (!ents.every((e) => e in uploads)) {
      core.ok(
        await db
          .from("ir_tickets")
          .update({ uploads: core.json(uploads) })
          .eq("id", t.id)
          .eq("status", "approved")
          .select("id"),
      );
      await db.from("ir_ticket_events").insert({
        ticket_id: t.id,
        action: "mark_uploaded",
        from_status: "approved",
        to_status: "approved",
        comment: data.entityCode,
        actor: context.userId,
      });
      return { status: "approved", done: Object.keys(uploads).length, of: ents.length };
    }
    const done = await core.transition(
      db,
      t.id,
      context.userId,
      ["approved"],
      "uploaded",
      "mark_uploaded",
      { comment: data.entityCode, patch: { uploads } },
    );
    const settings = await core.loadSettings(db);
    const owner = (await core.people(db, [t.user_id])).get(t.user_id);
    await mail.sendEmail(db, settings, {
      kind: "uploaded_user",
      ticketId: t.id,
      to: [owner?.email ?? ""],
      subject: `${done.ticket_no}: your items are now in the ERP`,
      html: mail.layout(
        `${done.ticket_no}: your items are now in the ERP`,
        mail.ticketFacts(done, owner?.name ?? ""),
      ),
    });
    return { status: done.status, done: ents.length, of: ents.length };
  });

/**
 * After an ERP import of one entity: compare every Uploaded ticket of the imported brands with the fresh ERP data.
 * A ticket becomes Verified in ERP when every entity it has was imported after the upload and every row matches.
 */
export const crossCheckTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entityCode: z.string(), brands: z.array(z.string()).max(5000) }))
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const { crossCheck, MISSING_TO_COLUMNS } = await import("@/lib/nmk/crossCheck");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const brands = new Set(data.brands.map((b) => b.toUpperCase()));
    const tickets = core
      .ok(await db.from("ir_tickets").select("*").eq("status", "uploaded").limit(200))
      .filter(
        (t) =>
          brands.has(t.brand_activity.toUpperCase()) &&
          ((t.entities ?? []) as unknown as { code: string }[]).some(
            (e) => e.code === data.entityCode,
          ),
      );
    const imports = core.ok(
      await db
        .from("erp_imports")
        .select("entity_code,imported_at,counts,active")
        .eq("active", true),
    );
    const out: {
      id: string;
      ticketNo: string;
      allMatch: boolean;
      checked: string[];
      waiting: string[];
      matched: number;
      total: number;
      mismatches: number;
    }[] = [];
    for (const t of tickets) {
      const ents = ((t.entities ?? []) as unknown as { code: string }[]).map((e) => e.code);
      const fresh = ents.filter((e) => {
        const i = imports.find((x) => x.entity_code === e);
        return i && t.uploaded_at && i.imported_at >= t.uploaded_at;
      });
      const rows = (await core.ticketRows(db, t.id)).filter((r) => fresh.includes(r.entityCode));
      const erp: Record<string, Awaited<ReturnType<typeof core.loadBrandErp>>> = {};
      for (const e of fresh) erp[e] = await core.loadBrandErp(db, e, t.brand_activity);
      const skip = [
        ...new Set(
          fresh.flatMap((e) => {
            const c = imports.find((x) => x.entity_code === e)?.counts as {
              missingColumns?: string[];
            } | null;
            return (c?.missingColumns ?? []).flatMap((m) => MISSING_TO_COLUMNS[m] ?? []);
          }),
        ),
      ];
      const res = crossCheck(
        rows.map((r) => ({ entityCode: r.entityCode, erp: r.erp })),
        erp,
        skip,
      );
      const waiting = ents.filter((e) => !fresh.includes(e));
      const verified = res.allMatch && waiting.length === 0;
      const summary = {
        ...res,
        waiting,
        skippedColumns: skip,
        mismatches: res.mismatches.slice(0, 500),
      };
      if (verified)
        await core.transition(db, t.id, context.userId, ["uploaded"], "verified", "verify", {
          comment: `Matches the ERP: ${res.perEntity.reduce((a, p) => a + p.matched, 0)} rows`,
          patch: { cross_check: summary },
        });
      else
        core.ok(
          await db
            .from("ir_tickets")
            .update({ cross_check: core.json(summary) })
            .eq("id", t.id)
            .select("id"),
        );
      out.push({
        id: t.id,
        ticketNo: t.ticket_no ?? "",
        allMatch: verified,
        checked: fresh,
        waiting,
        matched: res.perEntity.reduce((a, p) => a + p.matched, 0),
        total: res.perEntity.reduce((a, p) => a + p.total, 0),
        mismatches: res.mismatches.length,
      });
    }
    return out;
  });

/** Menu badges: tickets waiting on the Review, Approval and Upload pages. */
export const staffBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    const roles = await core.rolesOf(db, context.userId);
    if (!roles.some((r) => r !== "user")) return { review: 0, approval: 0, upload: 0 };
    const rows = core.ok(
      await db
        .from("ir_tickets")
        .select("status")
        .in("status", [
          "submitted",
          "in_review",
          "on_hold",
          "awaiting_approval",
          "approved",
          "uploaded",
        ])
        .limit(2000),
    );
    const n = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;
    return {
      review: n(["submitted", "in_review", "on_hold"]),
      approval: n(["awaiting_approval"]),
      upload: n(["approved", "uploaded"]),
    };
  });
