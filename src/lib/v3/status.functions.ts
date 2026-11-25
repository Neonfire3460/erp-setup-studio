// status.functions.ts: the ERP Items tool and Item Active/Inactive tickets.
//  - itemsBrowse: a brand's items in every entity's ERP data, split Active / Inactive, with pending and approved
//    changes already applied, so the brand manager sees the state they asked for.
//  - submitStatusChange: a ticket of kind "status_change" (number ST-...). Only the reviewer handles it.
//  - statusTicket / decideStatus: the reviewer's page. Approve puts it on the Upload page (Item Code + Inactive).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { idSchema } from "./schemas";

const OPEN = ["draft", "submitted", "in_review", "on_hold", "approved", "uploaded"];

async function overlay(
  db: Awaited<ReturnType<(typeof import("@/server/v3/core.server"))["adminDb"]>>,
  brand: string,
) {
  const core = await import("@/server/v3/core.server");
  const rows = core.ok(
    await db
      .from("item_status_changes")
      .select(
        "entity_code,item_code,inactive_to,state,created_at,ticket_id,ir_tickets(ticket_no,status)",
      )
      .ilike("brand_activity", core.likeExact(brand))
      .in("state", ["pending", "approved"])
      .order("created_at", { ascending: true })
      .limit(20000),
  ) as unknown as {
    entity_code: string;
    item_code: string;
    inactive_to: number;
    state: string;
    ticket_id: string;
    ir_tickets: { ticket_no: string | null; status: string } | null;
  }[];
  // Latest change per entity + item, from tickets that are still open (a verified ticket is already in the ERP).
  const map = new Map<
    string,
    { inactiveTo: 0 | 1; state: string; ticketNo: string; ticketId: string; ticketStatus: string }
  >();
  for (const r of rows)
    if (r.ir_tickets && OPEN.includes(r.ir_tickets.status))
      map.set(`${r.entity_code}|${r.item_code.toUpperCase()}`, {
        inactiveTo: r.inactive_to === 1 ? 1 : 0,
        state: r.state,
        ticketNo: r.ir_tickets.ticket_no ?? "",
        ticketId: r.ticket_id,
        ticketStatus: r.ir_tickets.status,
      });
  return map;
}

export const itemsBrowse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ brand: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireBrand(db, context.userId, data.brand);
    const entities = (await core.loadEntities(db)).filter((e) => e.active);
    const [lists, changes] = await Promise.all([
      Promise.all(entities.map((e) => core.loadBrandErp(db, e.code, data.brand))),
      overlay(db, data.brand),
    ]);
    const items = entities.flatMap((e, i) =>
      lists[i]!.map((it) => {
        const ch = changes.get(`${e.code}|${it.itemCode.toUpperCase()}`);
        const erpInactive = it.inactive === 1 ? 1 : 0;
        return {
          entityCode: e.code,
          itemCode: it.itemCode,
          description: it.description,
          web: it.web,
          b2b: it.web, // the ERP export has one WEB flag; B2B follows it
          erpInactive,
          inactive: ch ? ch.inactiveTo : erpInactive,
          change: ch && ch.inactiveTo !== erpInactive ? ch : null,
          cost: it.cost,
          costCurrency: it.costCurrency,
          retail: it.retail,
          maxDiscount: it.maxDiscount,
          family: it.familyName,
          group: it.groupName,
          category: it.categoryName,
          subCategory: it.subCategoryName,
          midwich: it.midwichName || it.midwichCode,
        };
      }),
    );
    return {
      entities: entities
        .map((e, i) => ({
          code: e.code,
          name: e.name,
          currency: e.currency,
          region: e.region,
          count: lists[i]!.length,
        }))
        .filter((e) => e.count > 0),
      items,
    };
  });

export const submitStatusChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1).max(200),
      neededBy: z.string().max(10),
      effectiveFrom: z.string().max(10).nullable().default(null),
      note: z.string().max(4000).default(""),
      changes: z
        .array(
          z.object({
            entityCode: z.string().max(10),
            itemCode: z.string().max(60),
            inactive: z.union([z.literal(0), z.literal(1)]),
          }),
        )
        .min(1)
        .max(5000),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const { checkNeededBy } = await import("@/lib/nmk/dates");
    const problem = checkNeededBy(data.neededBy, data.effectiveFrom);
    if (problem) throw new Error(problem);
    const db = await core.adminDb();
    await core.requireBrand(db, context.userId, data.brand);
    const entities = await core.loadEntities(db);
    const codes = [...new Set(data.changes.map((c) => c.entityCode))];
    const [lists, current] = await Promise.all([
      Promise.all(codes.map((c) => core.loadBrandErp(db, c, data.brand))),
      overlay(db, data.brand),
    ]);
    const erp = new Map<string, (typeof lists)[number][number]>(
      codes.flatMap((c, i) =>
        lists[i]!.map((it) => [`${c}|${it.itemCode.toUpperCase()}`, it] as [string, typeof it]),
      ),
    );
    const rows: {
      entityCode: string;
      itemCode: string;
      from: 0 | 1;
      to: 0 | 1;
      description: string;
    }[] = [];
    const seen = new Set<string>();
    for (const c of data.changes) {
      const k = `${c.entityCode}|${c.itemCode.toUpperCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const it = erp.get(k);
      if (!it) throw new Error(`${c.itemCode} is not in the ${c.entityCode} ERP data`);
      const ch = current.get(k);
      if (ch?.state === "pending")
        throw new Error(
          `${c.itemCode} (${c.entityCode}) already has a request waiting: ${ch.ticketNo}`,
        );
      const from = (ch ? ch.inactiveTo : it.inactive === 1 ? 1 : 0) as 0 | 1;
      if (from === c.inactive) continue; // already in that state
      rows.push({
        entityCode: c.entityCode,
        itemCode: it.itemCode,
        from,
        to: c.inactive,
        description: it.description,
      });
    }
    if (!rows.length) throw new Error("Nothing to change: every item is already in that state");
    const regionOf = (code: string) =>
      entities.find((e) => e.code === code)?.region === "SEA" ? "SEA" : "ME";
    const counts = Object.fromEntries(
      codes.map((c) => [
        c,
        { existing: 0, new: 0, changes: rows.filter((r) => r.entityCode === c).length },
      ]),
    );
    const t = core.ok(
      await db
        .from("ir_tickets")
        .insert({
          user_id: context.userId,
          brand_activity: data.brand,
          region: regionOf(codes[0]!),
          entities: core.json(
            codes
              .filter((c) => counts[c]!.changes)
              .map((c) => ({ code: c, costCurrency: "", ownCost: false })),
          ),
          kind: "status_change",
          needed_by: data.neededBy,
          effective_from: data.effectiveFrom || null,
          counts: core.json(counts),
          special_instructions: data.note,
          step: 7,
        })
        .select("id")
        .single(),
    );
    try {
      core.ok(
        await db
          .from("item_status_changes")
          .insert(
            rows.map((r) => ({
              ticket_id: t.id,
              entity_code: r.entityCode,
              item_code: r.itemCode,
              brand_activity: data.brand,
              inactive_from: r.from,
              inactive_to: r.to,
            })),
          )
          .select("id"),
      );
      const word = (v: 0 | 1) => (v ? "Inactive" : "Active");
      await core.insertChunks(
        db,
        "ir_ticket_rows",
        rows.map((r, i) => ({
          ticket_id: t.id,
          entity_code: r.entityCode,
          line_no: i + 1,
          item_code: r.itemCode,
          is_new: false,
          erp: core.json({ "Item Code": r.itemCode, Inactive: r.to }),
          names: core.json({ description: r.description, from: r.from }),
        })),
      );
      await core.insertChunks(
        db,
        "ir_ticket_items",
        rows.map((r, i) => ({
          ticket_id: t.id,
          line_no: i + 1,
          item_code: r.itemCode,
          description: r.description,
          alt_description: `${r.entityCode}: ${word(r.from)} → ${word(r.to)}`,
          cost: null,
        })),
      );
    } catch (e) {
      await db.from("ir_tickets").delete().eq("id", t.id);
      throw e;
    }
    let done = await core.transition(db, t.id, context.userId, ["draft"], "submitted", "submit", {
      comment: data.note || null,
    });
    const no = (done.ticket_no ?? "").replace(/^IR-/, "ST-");
    done = core.ok(
      await db.from("ir_tickets").update({ ticket_no: no }).eq("id", t.id).select("*").single(),
    );

    const settings = await core.loadSettings(db);
    const who = (await core.people(db, [context.userId])).get(context.userId);
    const toInactive = rows.filter((r) => r.to === 1).length;
    const facts: [string, string][] = [
      ...mail.ticketFacts(done, who?.name ?? "").filter(([k]) => k !== "Items"),
      ["Changes", `${toInactive} to Inactive, ${rows.length - toInactive} to Active`],
    ];
    const site = core.siteOrigin();
    await mail.sendEmail(db, settings, {
      kind: "submitted_admin",
      ticketId: t.id,
      to: [settings.adminInbox],
      subject: `New Active/Inactive request ${no}: ${data.brand}`,
      html: mail.layout(`New Active/Inactive request ${no}`, facts, {
        href: `${site}/review/${t.id}`,
        label: "Open it",
      }),
    });
    await mail.sendEmail(db, settings, {
      kind: "submitted_user",
      ticketId: t.id,
      to: [who?.email ?? ""],
      subject: `Your Active/Inactive request ${no}: ${data.brand}`,
      html: mail.layout(`We received ${no}`, facts, {
        href: `${site}/my-submissions/${t.id}`,
        label: "View it",
      }),
    });
    return { id: t.id, ticketNo: no, changes: rows.length };
  });

/** Reviewer's page for an Active/Inactive ticket. Opening a Submitted one starts the review. */
export const statusTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    let t = await core.loadTicket(db, data.id);
    if (t.kind !== "status_change") throw new Error("This is not an Active/Inactive ticket");
    if (t.status === "submitted")
      t = await core.transition(
        db,
        t.id,
        context.userId,
        ["submitted"],
        "in_review",
        "start_review",
      );
    const [changes, events, entities] = await Promise.all([
      db
        .from("item_status_changes")
        .select("*")
        .eq("ticket_id", t.id)
        .order("entity_code")
        .order("item_code")
        .then(core.ok),
      db.from("ir_ticket_events").select("*").eq("ticket_id", t.id).order("at").then(core.ok),
      core.loadEntities(db),
    ]);
    const names = new Map(
      core
        .ok(
          await db
            .from("ir_ticket_rows")
            .select("entity_code,item_code,names")
            .eq("ticket_id", t.id),
        )
        .map((r) => [
          `${r.entity_code}|${r.item_code}`,
          (r.names as { description?: string } | null)?.description ?? "",
        ]),
    );
    const who = await core.people(db, [t.user_id, t.reviewer_id, ...events.map((e) => e.actor)]);
    const name = (id: string | null) => (id ? (who.get(id)?.name ?? "") : "");
    return {
      ticket: t,
      owner: name(t.user_id),
      reviewer: name(t.reviewer_id),
      entities: entities.map((e) => ({ code: e.code, name: e.name })),
      changes: changes.map((c) => ({
        ...c,
        description: names.get(`${c.entity_code}|${c.item_code}`) ?? "",
      })),
      events: events.map((e) => ({ ...e, actorName: name(e.actor) })),
    };
  });

/** Approve (optionally leaving some rows out) or Reject. No approver step for this kind of ticket. */
export const decideStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      approve: z.boolean(),
      reason: z.string().max(2000).default(""),
      leaveOut: z.array(z.string().uuid()).max(5000).default([]),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["reviewer"]);
    const t = await core.loadTicket(db, data.id);
    if (t.kind !== "status_change") throw new Error("This is not an Active/Inactive ticket");
    const all = core.ok(
      await db.from("item_status_changes").select("id,entity_code,item_code").eq("ticket_id", t.id),
    );
    const out = new Set(data.leaveOut);
    const keep = all.filter((c) => !out.has(c.id));
    const now = new Date().toISOString();
    const settings = await core.loadSettings(db);
    const owner = (await core.people(db, [t.user_id])).get(t.user_id);
    if (!data.approve || !keep.length) {
      const reason = data.reason.trim() || "Every change was left out";
      const done = await core.transition(
        db,
        t.id,
        context.userId,
        ["submitted", "in_review", "on_hold"],
        "rejected",
        "reject",
        { comment: reason },
      );
      await db
        .from("item_status_changes")
        .update({ state: "rejected", decided_at: now })
        .eq("ticket_id", t.id);
      await mail.sendEmail(db, settings, {
        kind: "rejected_user",
        ticketId: t.id,
        to: [owner?.email ?? ""],
        subject: `${done.ticket_no} was rejected`,
        html: mail.layout(`${done.ticket_no} was rejected`, [
          ...mail.ticketFacts(done, owner?.name ?? ""),
          ["Reason", reason],
        ]),
      });
      return { status: "rejected" };
    }
    if (out.size) {
      await db
        .from("item_status_changes")
        .update({ state: "rejected", decided_at: now })
        .in("id", [...out]);
      for (const c of all.filter((x) => out.has(x.id)))
        await db
          .from("ir_ticket_rows")
          .delete()
          .eq("ticket_id", t.id)
          .eq("entity_code", c.entity_code)
          .eq("item_code", c.item_code);
    }
    await db
      .from("item_status_changes")
      .update({ state: "approved", decided_at: now })
      .in(
        "id",
        keep.map((c) => c.id),
      );
    const ents = [...new Set(keep.map((c) => c.entity_code))];
    const counts = Object.fromEntries(
      ents.map((e) => [
        e,
        { existing: 0, new: 0, changes: keep.filter((c) => c.entity_code === e).length },
      ]),
    );
    core.ok(
      await db
        .from("ir_tickets")
        .update({
          entities: core.json(ents.map((c) => ({ code: c, costCurrency: "", ownCost: false }))),
          counts: core.json(counts),
        })
        .eq("id", t.id)
        .select("id"),
    );
    const done = await core.transition(
      db,
      t.id,
      context.userId,
      ["submitted", "in_review", "on_hold"],
      "approved",
      "approve",
      {
        comment: out.size ? `${out.size} change${out.size === 1 ? "" : "s"} left out` : null,
      },
    );
    await mail.sendEmail(db, settings, {
      kind: "approved_user",
      ticketId: t.id,
      to: [owner?.email ?? ""],
      subject: `${done.ticket_no} is approved`,
      html: mail.layout(`${done.ticket_no} is approved`, [
        ...mail.ticketFacts(done, owner?.name ?? "").filter(([k]) => k !== "Items"),
        ["Changes approved", String(keep.length)],
        ...(out.size ? [["Left out", String(out.size)] as [string, string]] : []),
      ]),
    });
    return { status: "approved" };
  });
