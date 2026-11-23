// Emails, Rules, ERP data, AI learning, Self-test and Change log tabs.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Mail, Save, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, Label11, errText, fmtDate } from "@/components/v3/ui";
import { pricingSelfTest, sendTestEmail } from "@/lib/v3/admin.functions";
import { looseDb, type Row } from "./ListEditor";

type Settings = Record<string, unknown>;

function useSettings() {
  const [s, setS] = useState<Settings>({});
  const [orig, setOrig] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  async function load() {
    const r = await supabase.from("app_settings").select("key,value");
    if (r.error) {
      toast.error(r.error.message);
      return;
    }
    const m = Object.fromEntries(r.data.map((x) => [x.key, x.value]));
    setS(m);
    setOrig(m);
  }
  useEffect(() => {
    void load();
  }, []);
  const changed = Object.keys(s).filter((k) => JSON.stringify(s[k]) !== JSON.stringify(orig[k]));
  async function save() {
    setSaving(true);
    try {
      const r = await looseDb.from("app_settings").upsert(
        changed.map((key) => ({ key, value: s[key] })),
        { onConflict: "key" },
      );
      if (r.error) throw new Error(r.error.message);
      toast.success("Saved");
      await load();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setSaving(false);
    }
  }
  const set = (key: string, value: unknown) => setS((x) => ({ ...x, [key]: value }));
  const SaveBtn = () => (
    <Button size="sm" disabled={!changed.length || saving} onClick={save}>
      {saving ? <Loader2 className="animate-spin" /> : <Save />}Save
      {changed.length ? ` (${changed.length})` : ""}
    </Button>
  );
  return { s, set, SaveBtn };
}

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="grid gap-1 sm:grid-cols-[240px_1fr] sm:items-center">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    <div>{children}</div>
  </div>
);
const str = (v: unknown) =>
  typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);

const EMAIL_KINDS: [string, string][] = [
  ["submitted_admin", "New ticket → admin inbox"],
  ["submitted_user", "Ticket received → user"],
  ["awaiting_approval", "Waiting for approval → approvers"],
  ["approved_user", "Approved → user"],
  ["approved_reviewer", "Approved, with ERP files → reviewer"],
  ["hold_reviewer", "On hold → reviewer"],
  ["hold_user", "On hold → user"],
  ["rejected_user", "Rejected → user"],
  ["uploaded_user", "Uploaded to the ERP → user"],
];

export function EmailsTab() {
  const { s, set, SaveBtn } = useSettings();
  const [log, setLog] = useState<Row[]>([]);
  const [testing, setTesting] = useState(false);
  const loadLog = () =>
    looseDb
      .from("email_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(50)
      .then((r: { data: Row[] | null }) => setLog(r.data ?? []));
  useEffect(() => {
    void loadLog();
  }, []);
  const enabled = (s["emails_enabled"] ?? {}) as Record<string, boolean>;
  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <Label11>Email settings</Label11>
          <SaveBtn />
        </div>
        <p className="rounded-lg bg-accent/60 p-3 text-sm">
          Emails go through Resend. Add the <b>RESEND_API_KEY</b> secret in Lovable (Cloud →
          Secrets). With the sender <b>onboarding@resend.dev</b>, Resend only delivers to the email
          of your Resend account, so keep Test mode on until NMK's domain is verified in Resend.
        </p>
        <Field
          label="Test mode"
          hint="Every email goes to the test address, with the real recipient in the subject"
        >
          <Switch
            checked={s["email_test_mode"] === true}
            onCheckedChange={(v) => set("email_test_mode", v)}
          />
        </Field>
        <Field label="Test address">
          <Input
            value={str(s["email_test_address"])}
            onChange={(e) => set("email_test_address", e.target.value)}
          />
        </Field>
        <Field label="Admin inbox" hint="Gets the New ticket email">
          <Input
            value={str(s["admin_inbox"])}
            onChange={(e) => set("admin_inbox", e.target.value)}
          />
        </Field>
        <Field label="From" hint='For example "NMK Unite <unite@your-domain.com>"'>
          <Input value={str(s["email_from"])} onChange={(e) => set("email_from", e.target.value)} />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Which emails are sent</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EMAIL_KINDS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={enabled[k] !== false}
                  onCheckedChange={(v) => set("emails_enabled", { ...enabled, [k]: v })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            try {
              const r = await sendTestEmail();
              if (r.status === "sent") toast.success("Test email sent. Check the inbox.");
              else toast.error(`Not sent: ${r.error ?? r.status}`);
              void loadLog();
            } catch (e) {
              toast.error(errText(e));
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? <Loader2 className="animate-spin" /> : <Mail />}Send me a test email
        </Button>
      </Card>
      <Card className="space-y-2">
        <Label11>Last 50 emails</Label11>
        <div className="max-h-96 overflow-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-muted text-left text-[11px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Kind</th>
                <th className="p-2">To</th>
                <th className="p-2">Subject</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={String(l["id"])} className="border-t">
                  <td className="whitespace-nowrap p-2">{fmtDate(str(l["created_at"]))}</td>
                  <td className="p-2">{str(l["kind"])}</td>
                  <td className="p-2">
                    {str(l["to_address"])}
                    {l["real_to"] ? (
                      <span className="text-muted-foreground"> (for {str(l["real_to"])})</span>
                    ) : null}
                  </td>
                  <td className="p-2">{str(l["subject"])}</td>
                  <td
                    className={l["status"] === "sent" ? "p-2 text-success" : "p-2 text-destructive"}
                    title={str(l["error"])}
                  >
                    {str(l["status"])}
                    {l["error"] ? `: ${str(l["error"]).slice(0, 80)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function RulesTab() {
  const { s, set, SaveBtn } = useSettings();
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <Label11>Rules</Label11>
        <SaveBtn />
      </div>
      <Field label="Big price change warning, %" hint="Price changes above ± this are highlighted">
        <Input
          className="w-28"
          inputMode="decimal"
          value={str(s["price_change_warn_pct"])}
          onChange={(e) =>
            set("price_change_warn_pct", e.target.value === "" ? null : Number(e.target.value))
          }
        />
      </Field>
      <Field label="Hold needs a comment">
        <Switch
          checked={s["hold_comment_required"] === true}
          onCheckedChange={(v) => set("hold_comment_required", v)}
        />
      </Field>
      <Field label="Block self-approval" hint="The reviewer of a ticket can't also approve it">
        <Switch
          checked={s["block_self_approval"] === true}
          onCheckedChange={(v) => set("block_self_approval", v)}
        />
      </Field>
      <Field label="PDF notice line">
        <Input
          value={str(s["pdf_notice_line"])}
          onChange={(e) => set("pdf_notice_line", e.target.value)}
        />
      </Field>
      <Field label="PDF confidential line" hint="Bottom left of every page">
        <Textarea
          rows={2}
          value={str(s["pdf_confidential_line"])}
          onChange={(e) => set("pdf_confidential_line", e.target.value)}
        />
      </Field>
    </Card>
  );
}

export function ErpDataTab() {
  const [stats, setStats] = useState<
    { entity_code: string; row_count: number; active_count: number }[]
  >([]);
  const [imports, setImports] = useState<Row[]>([]);
  useEffect(() => {
    void supabase.rpc("erp_entity_stats").then((r) => setStats(r.data ?? []));
    void looseDb
      .from("erp_imports")
      .select("entity_code,imported_at,brands,row_count,file_name")
      .eq("active", true)
      .order("imported_at", { ascending: false })
      .limit(50)
      .then((r: { data: Row[] | null }) => setImports(r.data ?? []));
  }, []);
  const last = (code: string) => imports.find((i) => i["entity_code"] === code);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <Label11>ERP data per entity</Label11>
        <Button size="sm" asChild>
          <Link to="/erp-import" search={{}}>
            Import ERP data
          </Link>
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] font-semibold uppercase text-muted-foreground">
          <tr>
            <th className="p-2">Entity</th>
            <th className="p-2 text-right">Items</th>
            <th className="p-2 text-right">Active</th>
            <th className="p-2">Last import</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const l = last(s.entity_code);
            return (
              <tr key={s.entity_code} className="border-t">
                <td className="p-2 font-semibold">{s.entity_code}</td>
                <td className="p-2 text-right tabular-nums">
                  {Number(s.row_count).toLocaleString()}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {Number(s.active_count).toLocaleString()}
                </td>
                <td className="p-2 text-muted-foreground">
                  {l
                    ? `${fmtDate(str(l["imported_at"]))} · ${((l["brands"] as string[]) ?? []).slice(0, 4).join(", ") || "all brands"}`
                    : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        The ERP data is confidential: only staff can read it, and it is never sent to users'
        browsers.
      </p>
    </Card>
  );
}

export function AiTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () =>
    looseDb
      .from("brand_ai_profiles")
      .select("id,brand_activity,times_used,updated_at")
      .order("updated_at", { ascending: false })
      .then((r: { data: Row[] | null }) => setRows(r.data ?? []));
  useEffect(() => {
    void load();
  }, []);
  return (
    <Card className="space-y-3">
      <Label11>AI learning</Label11>
      <p className="text-sm text-muted-foreground">
        Option A (the AI reads a vendor's own pricelist) comes in the next update. What it learns
        about each vendor's file layout shows here, and you can delete a layout so it learns again.
        The AI never sets codes or prices.
      </p>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">Nothing learned yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={str(r["id"])} className="border-t">
                <td className="p-2 font-semibold">{str(r["brand_activity"])}</td>
                <td className="p-2">used {str(r["times_used"])} times</td>
                <td className="p-2 text-muted-foreground">{fmtDate(str(r["updated_at"]))}</td>
                <td className="p-2 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await looseDb.from("brand_ai_profiles").delete().eq("id", r["id"]);
                      void load();
                    }}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function SelfTestTab() {
  const [res, setRes] = useState<Awaited<ReturnType<typeof pricingSelfTest>> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <Label11>Pricing self-test</Label11>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setRes(await pricingSelfTest());
            } catch (e) {
              toast.error(errText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" />}Run
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Runs the retail formula on known cases from NMK's ERP (Turtle AV in 001, 011, 007, 008). It
        reads no data and costs nothing.
      </p>
      {res && (
        <>
          <p className="font-semibold">
            {res.filter((r) => r.pass).length} of {res.length} passed
          </p>
          <ul className="space-y-1 text-sm">
            {res.map((r) => (
              <li key={r.name} className="flex items-center gap-2">
                {r.pass ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                {r.name}: expected {r.expected}, got {r.got}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function ChangeLogTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [table, setTable] = useState("");
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let q = looseDb.from("change_log").select("*").order("id", { ascending: false }).limit(200);
    if (table) q = q.eq("table_name", table);
    void q.then((r: { data: Row[] | null }) => setRows(r.data ?? []));
  }, [table]);
  useEffect(() => {
    void supabase
      .rpc("admin_list_users")
      .then((r) =>
        setNames(new Map((r.data ?? []).map((u) => [u.user_id, u.full_name || u.email]))),
      );
  }, []);
  const diff = (r: Row) => {
    const o = (r["old_row"] ?? {}) as Row,
      n = (r["new_row"] ?? {}) as Row;
    if (r["action"] === "INSERT")
      return `added ${Object.values(n)
        .filter((v) => typeof v === "string")
        .slice(0, 2)
        .join(" · ")}`;
    if (r["action"] === "DELETE")
      return `deleted ${Object.values(o)
        .filter((v) => typeof v === "string")
        .slice(0, 2)
        .join(" · ")}`;
    return Object.keys(n)
      .filter((k) => k !== "updated_at" && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
      .map(
        (k) =>
          `${k}: ${JSON.stringify(o[k])?.slice(0, 40)} → ${JSON.stringify(n[k])?.slice(0, 40)}`,
      )
      .join("; ");
  };
  const TABLES = [
    "entities",
    "currencies",
    "brands",
    "sub_activities",
    "brand_suppliers",
    "units",
    "categories",
    "midwich_families",
    "pdf_orders",
    "fx_rates",
    "pricing_rules",
    "app_settings",
  ];
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label11>Change log (last 200)</Label11>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={table}
          onChange={(e) => setTable(e.target.value)}
        >
          <option value="">All settings</option>
          {TABLES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="max-h-[560px] overflow-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-muted text-left text-[11px] font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">Who</th>
              <th className="p-2">Table</th>
              <th className="p-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={str(r["id"])} className="border-t align-top">
                <td className="whitespace-nowrap p-2">{fmtDate(str(r["changed_at"]))}</td>
                <td className="p-2">{names.get(str(r["changed_by"])) ?? ""}</td>
                <td className="p-2">{str(r["table_name"])}</td>
                <td className="p-2 break-all">{diff(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
