// admin.functions.ts: Admin settings actions that need the service role (users, test email, self-test).
// Plain list edits (entities, brands, rules, rates, units...) are done in the browser under RLS "staff write".
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const roleList = z.array(z.enum(["admin", "reviewer", "approver", "user"])).min(1);

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ok } = await import("@/server/v3/core.server");
    const r = ok(
      await context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    );
    return r.map((x) => x.role as string);
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().trim().email(),
      fullName: z.string().trim().min(1).max(120),
      password: z.string().min(8).max(72),
      roles: roleList,
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["admin"]);
    const r = await db.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (r.error || !r.data.user) throw new Error(r.error?.message ?? "Could not create the user");
    const id = r.data.user.id;
    await db
      .from("profiles")
      .upsert({ id, email: data.email, full_name: data.fullName, active: true });
    await db.from("user_roles").delete().eq("user_id", id);
    core.ok(
      await db
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: id, role })))
        .select("id"),
    );
    return { id };
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), roles: roleList }))
  .handler(async ({ data, context }) => {
    const { ok } = await import("@/server/v3/core.server");
    ok(
      await context.supabase
        .rpc("admin_set_roles", { _user_id: data.userId, _roles: data.roles })
        .then((r) => ({ ...r, data: true })),
    );
    return { ok: true };
  });

/** Disable = the account can't sign in any more (its tickets stay). */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      active: z.boolean(),
      fullName: z.string().trim().max(120).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["admin"]);
    if (data.userId === context.userId && !data.active)
      throw new Error("You can't disable your own account");
    const r = await db.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
      ...(data.fullName ? { user_metadata: { full_name: data.fullName } } : {}),
    });
    if (r.error) throw new Error(r.error.message);
    core.ok(
      await db
        .from("profiles")
        .update({ active: data.active, ...(data.fullName ? { full_name: data.fullName } : {}) })
        .eq("id", data.userId)
        .select("id"),
    );
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const core = await import("@/server/v3/core.server");
    const mail = await import("@/server/v3/email.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, core.STAFF);
    const s = await core.loadSettings(db);
    const me = (await core.people(db, [context.userId])).get(context.userId);
    const r = await mail.sendEmail(db, s, {
      kind: "test",
      to: [me?.email ?? s.adminInbox],
      subject: "NMK Unite test email",
      html: mail.layout("Test email", [
        "If you can read this, emails work.",
        ["Test mode", s.testMode ? "On" : "Off"],
        ["From", s.emailFrom],
      ]),
    });
    const last = core.ok(
      await db.from("email_log").select("status,error").order("id", { ascending: false }).limit(1),
    )[0];
    return { status: r.status, error: last?.error ?? null };
  });

export const pricingSelfTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const core = await import("@/server/v3/core.server");
    const { runSelfTest } = await import("@/lib/nmk/pricing");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, core.STAFF);
    return runSelfTest();
  });

/**
 * Admin only: delete test data. Tickets (rows, items, history and edits go with them), approved prices
 * from tickets, the email log and PDF history. Users, categories, ERP data and all settings stay.
 */
export const clearTestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ confirm: z.literal("CLEAR") }))
  .handler(async ({ context }) => {
    const core = await import("@/server/v3/core.server");
    const db = await core.adminDb();
    await core.requireRole(db, context.userId, ["admin"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const del = async (table: string, f: (q: any) => any) => {
      const r = await f((db as any).from(table).delete({ count: "exact" })); // eslint-disable-line @typescript-eslint/no-explicit-any
      if (r.error) throw new Error(`${table}: ${r.error.message}`);
      return (r.count as number | null) ?? 0;
    };
    const prices = await del("approved_prices", (q) => q.not("ticket_id", "is", null));
    const emails = await del("email_log", (q) => q.gte("id", 0));
    const pdfs = await del("pdf_history", (q) => q.not("id", "is", null));
    const tickets = await del("ir_tickets", (q) => q.not("id", "is", null));
    return { tickets, prices, emails, pdfs };
  });
