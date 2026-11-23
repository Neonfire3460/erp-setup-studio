// email.server.ts: the 9 ticket emails (plan "Emails"), sent with Resend (secret RESEND_API_KEY).
// Test mode sends every email to the test address with the real recipient in the subject.
// An email problem never stops the ticket: it is written to email_log with the error.
import type { DB, Settings, TicketRecord } from "./core.server";

export type EmailKind =
  | "submitted_admin"
  | "submitted_user"
  | "awaiting_approval"
  | "approved_user"
  | "approved_reviewer"
  | "hold_reviewer"
  | "hold_user"
  | "rejected_user"
  | "uploaded_user"
  | "test";

export interface Attachment {
  filename: string;
  content: string;
} // base64

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function layout(
  title: string,
  lines: (string | [string, string])[],
  link?: { href: string; label: string },
) {
  const body = lines
    .map((l) =>
      Array.isArray(l)
        ? `<tr><td style="padding:4px 12px 4px 0;color:#5b6670;white-space:nowrap;vertical-align:top">${esc(l[0])}</td><td style="padding:4px 0">${esc(l[1])}</td></tr>`
        : `<tr><td colspan="2" style="padding:6px 0">${esc(l)}</td></tr>`,
    )
    .join("");
  const button = link
    ? `<p style="margin:20px 0 0"><a href="${esc(link.href)}" style="background:#4654FD;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#141E23;max-width:620px">
<div style="height:3px;background:linear-gradient(90deg,#0E2579,#4654FD,#05C3BC)"></div>
<h2 style="font-size:18px;margin:18px 0 10px">${esc(title)}</h2><table style="border-collapse:collapse">${body}</table>${button}
<p style="color:#8a949c;font-size:12px;margin-top:24px">NMK Unite · Item Registration</p></div>`;
}

export async function sendEmail(
  db: DB,
  s: Settings,
  e: {
    kind: EmailKind;
    to: string[];
    subject: string;
    html: string;
    ticketId?: string | null;
    attachments?: Attachment[];
  },
) {
  const real = [...new Set(e.to.filter(Boolean))];
  if (e.kind !== "test" && !s.emailsEnabled(e.kind)) return { status: "off" as const };
  const to = s.testMode ? [s.testAddress || s.adminInbox].filter(Boolean) : real;
  const subject = s.testMode ? `[TEST to: ${real.join(", ") || "nobody"}] ${e.subject}` : e.subject;
  const log = async (status: string, error?: string) => {
    await db.from("email_log").insert({
      ticket_id: e.ticketId ?? null,
      kind: e.kind,
      to_address: to.join(", ") || "-",
      real_to: real.join(", "),
      subject,
      status,
      error: error ?? null,
    });
  };
  if (!to.length) {
    await log("skipped", "No recipient");
    return { status: "skipped" as const };
  }
  const key = process.env["RESEND_API_KEY"];
  if (!key) {
    await log("skipped", "RESEND_API_KEY is not set");
    return { status: "skipped" as const };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: s.emailFrom,
        to,
        subject,
        html: e.html,
        ...(e.attachments?.length ? { attachments: e.attachments } : {}),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      await log("failed", `${res.status} ${t.slice(0, 400)}`);
      return { status: "failed" as const };
    }
    await log("sent");
    return { status: "sent" as const };
  } catch (err) {
    await log("failed", err instanceof Error ? err.message : "Network error");
    return { status: "failed" as const };
  }
}

type Counts = Record<
  string,
  { rows: number; new: number; existing: number; bigChange: number; missing: number }
>;
interface PriceSummary {
  compared: number;
  up: number;
  down: number;
  unchanged: number;
  avgPct: number | null;
}

export function ticketFacts(t: TicketRecord, owner: string) {
  const ents = (t.entities as unknown as { code: string; costCurrency: string }[]) ?? [];
  const counts = (t.counts ?? {}) as unknown as Counts;
  const first = Object.values(counts)[0];
  const ps = (t.price_summary ?? null) as unknown as PriceSummary | null;
  const facts: [string, string][] = [
    ["Ticket", t.ticket_no ?? "-"],
    ["Brand", t.brand_activity],
    ["Entities", ents.map((e) => `${e.code} (cost ${e.costCurrency})`).join(", ")],
    ["Sent by", owner],
  ];
  if (first) facts.push(["Items", `${first.existing} existing, ${first.new} new`]);
  if (ps)
    facts.push([
      "Price changes",
      `${ps.up} up, ${ps.down} down, ${ps.unchanged} unchanged${ps.avgPct === null ? "" : `, average ${ps.avgPct > 0 ? "+" : ""}${ps.avgPct.toFixed(1)}%`}`,
    ]);
  if (t.special_instructions) facts.push(["Special instructions", t.special_instructions]);
  return facts;
}
