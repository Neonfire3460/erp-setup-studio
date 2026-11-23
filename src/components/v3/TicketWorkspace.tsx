// Review page (Reviewer) and Approval page (Approver) for one ticket.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  MessageSquareWarning,
  PauseCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataGrid, type GridCol, type GridRow, type QuickFilter } from "@/components/v3/DataGrid";
import {
  Card,
  ConfirmDialog,
  Label11,
  PageHeader,
  TextDialog,
  TicketStatusBadge,
  errText,
  fmtDate,
  fmtNum,
  fmtPct,
} from "@/components/v3/ui";
import {
  approveTicket,
  editCells,
  holdTicket,
  proceedTicket,
  recalcTicket,
  rejectTicket,
  staffTicket,
} from "@/lib/v3/tickets.functions";
import { APPROVAL_COLUMNS, REVIEW_COLUMNS, gridRow } from "@/lib/nmk/ticket";
import { cn } from "@/lib/utils";

type Data = Awaited<ReturnType<typeof staffTicket>>;
type Row = Data["rows"][number];

const NUMBER = new Set([
  "Cost Price",
  "Exchange rate",
  "Overhead %",
  "Landed cost",
  "MSRP",
  "Retail Price",
  "Current retail",
  "Retail change %",
  "Max Discount",
  "Inactive",
  "Webactive",
  "B2B",
]);
const READ_ONLY = new Set([
  "Item Code",
  "Landed cost",
  "MSRP",
  "Current retail",
  "Retail change %",
]);
const WIDTH: Record<string, number> = {
  "Item Code": 170,
  Supplier: 120,
  Description: 280,
  "Alternate Description": 240,
  "Det. Description": 220,
  "Alternative Code": 160,
  "Brand Activity": 130,
  "Sub Activity": 130,
  "Family Name": 150,
  "Group Name": 190,
  "Category Name": 210,
  "Sub Category Name": 150,
  "Midwich Family": 170,
  "Measurement Unit": 110,
  Inactive: 90,
  Webactive: 100,
  B2B: 80,
  "Margin divisor": 120,
};
const SETUP_TAB: Record<string, string> = {
  pricing_rule: "pricing",
  fx: "fx",
  supplier: "brands",
  new_supplier: "brands",
  unit: "units",
  category: "categories",
};

export function TicketWorkspace({ id, mode }: { id: string; mode: "review" | "approval" }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, error, refetch } = useQuery({
    queryKey: ["staff-ticket", id],
    queryFn: () => staffTicket({ data: { id } }),
  });
  const [dialog, setDialog] = useState<"reject" | "hold" | "approve" | null>(null);
  const [working, setWorking] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const all = rows ?? data?.rows ?? [];
  const edited = useMemo(
    () => new Set((data?.edits ?? []).map((e) => `${e.row_id}|${e.column_name}`)),
    [data],
  );

  if (error) return <p className="text-sm text-destructive">{errText(error)}</p>;
  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading the ticket...
      </div>
    );
  const t = data.ticket;
  const canEdit = mode === "review" && ["in_review", "on_hold", "submitted"].includes(t.status);
  const canDecide = mode === "approval" && t.status === "awaiting_approval";
  const ents = (t.entities ?? []) as { code: string; costCurrency: string; ownCost: boolean }[];
  const suppliers = (t.suppliers ?? []) as {
    entityCode: string;
    supplierCode: string;
    supplierName: string;
    answer: string;
    newName?: string;
    newCode?: string;
  }[];
  const holds = data.events.filter((e) => e.action === "hold");
  const blocked = all.filter(
    (r) => r.erp["Retail Price"] === null || r.flags.some((f) => f.startsWith("missing_")),
  );
  const ename = (c: string) => data.entities.find((e) => e.code === c);

  async function act(fn: () => Promise<unknown>, done: string, leave = true) {
    setWorking(true);
    try {
      await fn();
      toast.success(done);
      await qc.invalidateQueries({ queryKey: ["staff-badges"] });
      if (leave) navigate({ to: mode === "review" ? "/review" : "/approval" });
      else {
        setRows(null);
        await refetch();
      }
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setWorking(false);
      setDialog(null);
    }
  }

  async function onEdit(row: GridRow, key: string, value: string) {
    const r = all.find((x) => x.id === row._id);
    if (!r) return;
    try {
      const res = await editCells({
        data: {
          ticketId: id,
          edits: [{ rowId: r.id, column: key as never, value: value === "" ? null : value }],
        },
      });
      const next = new Map(res.rows.map((x) => [x.id, x]));
      setRows(all.map((x) => (next.has(x.id) ? { ...x, ...next.get(x.id)! } : x)));
      void refetch().then(() => setRows(null));
    } catch (e) {
      toast.error(errText(e));
    }
  }

  const columns: GridCol[] = (mode === "review" ? REVIEW_COLUMNS : APPROVAL_COLUMNS).map((k) => ({
    key: k,
    label: k === "Retail Price" ? "Retail (new)" : k,
    type: NUMBER.has(k) ? "number" : "text",
    width: WIDTH[k] ?? (NUMBER.has(k) ? 110 : 150),
    editable: canEdit && !READ_ONLY.has(k),
    ...(k === "Retail change %" ? { format: (v: unknown) => fmtPct(v as number | null) } : {}),
    ...(k === "Overhead %"
      ? { format: (v: unknown) => (v === null || v === undefined ? "" : `${v}%`) }
      : {}),
    ...(k === "Inactive" || k === "Webactive" || k === "B2B"
      ? {
          options: [
            { value: "0", label: "0" },
            { value: "1", label: "1" },
          ],
        }
      : {}),
  }));
  const names = (r: Row, k: string) =>
    k === "Family Name"
      ? r.names.family
      : k === "Group Name"
        ? r.names.group
        : k === "Category Name"
          ? r.names.category
          : k === "Midwich Family"
            ? r.names.midwich
            : k === "Measurement Unit"
              ? r.names.unit
              : "";
  for (const c of columns)
    if (
      ["Family Name", "Group Name", "Category Name", "Midwich Family", "Measurement Unit"].includes(
        c.key,
      )
    )
      c.format = (v, row) => {
        const r = all.find((x) => x.id === row._id);
        const n = r ? names(r, c.key) : "";
        return v ? (n && n !== v ? `${String(v)} · ${n}` : String(v)) : "";
      };

  const quick: QuickFilter[] = [
    {
      key: "new",
      label: "New items",
      tone: "info",
      test: (r) => (r["_flags"] as string[]).includes("new"),
    },
    {
      key: "big",
      label: `Over ±${data.warnPct}%`,
      tone: "warning",
      test: (r) => (r["_flags"] as string[]).includes("big_change"),
    },
    ...(mode === "review"
      ? [
          {
            key: "missing",
            label: "Missing setup",
            tone: "error" as const,
            test: (r: GridRow) =>
              r["Retail Price"] === null ||
              (r["_flags"] as string[]).some((f) => f.startsWith("missing_")),
          },
          {
            key: "supplier",
            label: "Supplier changed",
            tone: "warning" as const,
            test: (r: GridRow) => (r["_flags"] as string[]).includes("supplier_changed"),
          },
        ]
      : []),
    {
      key: "edited",
      label: "Edited",
      tone: "info",
      test: (r) => (r["_flags"] as string[]).includes("edited"),
    },
  ];
  const rowClass = (r: GridRow) => {
    const f = r["_flags"] as string[];
    return r["Retail Price"] === null || f.some((x) => x.startsWith("missing_"))
      ? "bg-destructive-soft"
      : f.includes("new")
        ? "bg-accent/60"
        : undefined;
  };
  const cellClass = (r: GridRow, k: string) => {
    const f = r["_flags"] as string[];
    if (edited.has(`${r._id}|${k}`)) return "bg-primary/10 font-semibold text-primary";
    if (k === "Supplier" && f.includes("supplier_changed"))
      return "bg-warning-soft text-warning font-semibold";
    if (k === "Description" && f.includes("vendor_description")) return "bg-brand-cyan/15";
    if ((k === "Retail Price" || k === "Retail change %") && f.includes("big_change"))
      return "bg-warning-soft text-warning font-semibold";
    if (k === "Retail Price" && f.includes("manual_retail")) return "italic text-primary";
    return undefined;
  };

  return (
    <div className="min-w-0 space-y-5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: mode === "review" ? "/review" : "/approval" })}
      >
        <ArrowLeft />
        {mode === "review" ? "Review queue" : "Approval queue"}
      </Button>
      <PageHeader
        title={`${t.ticket_no} · ${t.brand_activity}`}
        description={`${data.owner} · submitted ${fmtDate(t.submitted_at)} · ${ents.map((e) => `${e.code} ${ename(e.code)?.currency ?? ""} (cost ${e.costCurrency})`).join(", ")}${data.reviewer ? ` · reviewer ${data.reviewer}` : ""}`}
        actions={
          <>
            <TicketStatusBadge status={t.status} />
            {canEdit && (
              <Button
                variant="outline"
                disabled={working}
                onClick={() => act(() => recalcTicket({ data: { id } }), "Recalculated", false)}
              >
                <RefreshCw />
                Recalculate
              </Button>
            )}
            {(canEdit || canDecide) && (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={working}
                onClick={() => setDialog("reject")}
              >
                <X />
                Reject
              </Button>
            )}
            {canDecide && (
              <Button variant="outline" disabled={working} onClick={() => setDialog("hold")}>
                <PauseCircle />
                Hold
              </Button>
            )}
            {canEdit && (
              <Button
                disabled={working || blocked.length > 0 || data.missing.length > 0}
                title={
                  blocked.length || data.missing.length ? "Add the missing setup first" : undefined
                }
                onClick={() => act(() => proceedTicket({ data: { id } }), "Sent for approval")}
              >
                <Check />
                Proceed
              </Button>
            )}
            {canDecide && (
              <Button disabled={working} onClick={() => setDialog("approve")}>
                <Check />
                Approve
              </Button>
            )}
          </>
        }
      />

      {t.special_instructions && (
        <Card className="border-primary/30 bg-accent">
          <Label11>Special instructions</Label11>
          <p className="mt-1 text-sm">{t.special_instructions}</p>
        </Card>
      )}
      {mode === "review" && holds.length > 0 && (
        <Card className="space-y-2 border-warning/30 bg-warning-soft">
          <Label11 className="text-warning">Approver's comments</Label11>
          {holds.map((h) => (
            <p key={h.id} className="text-sm">
              <MessageSquareWarning className="mr-1 inline size-4 text-warning" />
              {h.comment}{" "}
              <span className="text-muted-foreground">
                · {h.actorName}, {fmtDate(h.at)}
              </span>
            </p>
          ))}
        </Card>
      )}
      {mode === "review" && data.missing.length > 0 && (
        <Card className="space-y-2 border-destructive/30 bg-destructive-soft">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            Missing setup: Proceed is blocked until each is added, then press Recalculate
          </p>
          {data.missing.map((m, i) => (
            <p key={i} className="flex flex-wrap items-center gap-2 text-sm">
              {m.text}
              <Link
                to="/admin"
                search={{ tab: SETUP_TAB[m.kind] ?? "pricing", brand: data.ticket.brand_activity }}
                className="font-semibold text-primary hover:underline"
              >
                Open Admin settings
              </Link>
            </p>
          ))}
        </Card>
      )}
      {mode === "review" && suppliers.some((s) => s.answer === "different") && (
        <Card className="border-warning/30 bg-warning-soft text-sm">
          <Label11 className="text-warning">Supplier changed by the user</Label11>
          {suppliers
            .filter((s) => s.answer === "different")
            .map((s) => (
              <p key={s.entityCode} className="mt-1">
                {s.entityCode}: was {s.supplierName || s.supplierCode || "none"}, now{" "}
                <b>{s.newName}</b>
                {s.newCode
                  ? ` (${s.newCode})`
                  : " (no code yet: add it in Suppliers, or type it in the Supplier column)"}
              </p>
            ))}
        </Card>
      )}

      <Tabs defaultValue={ents[0]?.code ?? ""}>
        <TabsList>
          {ents.map((e) => {
            const n = all.filter((r) => r.entityCode === e.code);
            const bad = n.some(
              (r) =>
                r.erp["Retail Price"] === null || r.flags.some((f) => f.startsWith("missing_")),
            );
            const warn = n.some((r) => r.flags.includes("big_change"));
            return (
              <TabsTrigger key={e.code} value={e.code}>
                {ename(e.code)?.name ?? e.code} · {n.length}
                {bad ? (
                  <span className="ml-1.5 size-2 rounded-full bg-destructive" />
                ) : warn ? (
                  <span className="ml-1.5 size-2 rounded-full bg-warning" />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {ents.map((e) => (
          <TabsContent key={e.code} value={e.code} className="min-w-0">
            <DataGrid
              rows={all
                .filter((r) => r.entityCode === e.code)
                .map((r) => ({ ...gridRow(r), _id: r.id }) as GridRow)}
              columns={columns}
              frozen={mode === "review" ? 2 : 2}
              height={600}
              onEdit={canEdit ? onEdit : (undefined as never)}
              rowClass={rowClass}
              cellClass={cellClass}
              quickFilters={quick}
              {...(mode === "review"
                ? { hiddenByDefault: ["Det. Description", "Brand Activity"] }
                : {})}
            />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Blue rows: new items. Red rows: missing setup. Amber: supplier changed, or retail change
        over ±{data.warnPct}%. Bold blue cells: edited by the reviewer.{" "}
        {canEdit
          ? "Double-click a cell to edit it. Changing cost, exchange rate, overhead or divisor recalculates the retail."
          : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Collapsible className="rounded-[10px] border bg-card p-4">
          <CollapsibleTrigger className="text-sm font-semibold text-primary">
            History ({data.events.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-1 text-sm">
            {data.events.map((e) => (
              <p key={e.id}>
                <span className="text-muted-foreground">{fmtDate(e.at)}</span> ·{" "}
                {e.actorName || "System"} · {e.action.replace(/_/g, " ")}
                {e.comment ? `: ${e.comment}` : ""}
                {e.internal ? " (internal)" : ""}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
        <Collapsible className="rounded-[10px] border bg-card p-4">
          <CollapsibleTrigger className="text-sm font-semibold text-primary">
            Edits ({data.edits.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 max-h-80 space-y-1 overflow-auto text-sm">
            {data.edits.map((e) => (
              <p key={e.id}>
                <span className="text-muted-foreground">{fmtDate(e.at)}</span> · {e.actorName} ·{" "}
                {e.entity_code} {e.item_code} · {e.column_name}: {fmtValue(e.old_value)} →{" "}
                <b>{fmtValue(e.new_value)}</b>
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <TextDialog
        open={dialog === "reject"}
        title="Reject this ticket"
        description="The brand manager sees the reason in red and can resubmit."
        placeholder="Reason for rejection"
        required
        confirm="Reject"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={(reason) => act(() => rejectTicket({ data: { id, reason } }), "Rejected")}
      />
      <TextDialog
        open={dialog === "hold"}
        title="Hold request"
        description="The ticket goes back to the reviewer with your comments. The user only sees On hold."
        placeholder="Please add comments for the reviewer"
        required={data.holdCommentRequired}
        confirm="Send back to the reviewer"
        onClose={() => setDialog(null)}
        onConfirm={(comment) => act(() => holdTicket({ data: { id, comment } }), "Put on hold")}
      />
      <ConfirmDialog
        open={dialog === "approve"}
        title={`Approve ${t.ticket_no}?`}
        description={
          <p>
            The user is emailed "Approved". The reviewer is emailed the ERP Excel file for each
            entity ({ents.length}), and the ticket moves to the Upload page.
          </p>
        }
        confirm="Approve"
        onClose={() => setDialog(null)}
        onConfirm={() => act(() => approveTicket({ data: { id } }), "Approved")}
      />
    </div>
  );
}

const fmtValue = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "(blank)"
    : typeof v === "number"
      ? fmtNum(v, 4)
      : String(v);

export function QueueTable({
  rows,
  onOpen,
  mode,
}: {
  rows: {
    id: string;
    ticket_no: string | null;
    brand_activity: string;
    entities: unknown;
    counts: unknown;
    status: string;
    owner: string;
    reviewer: string;
    submitted_at: string | null;
    proceeded_at: string | null;
    decided_at: string | null;
    missing_setup: unknown;
  }[];
  onOpen: (id: string) => void;
  mode: "review" | "approval";
}) {
  return (
    <div className="overflow-auto rounded-[10px] border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          <tr>
            {[
              "Ticket",
              "Brand",
              "From",
              "Entities",
              "Items",
              "Status",
              mode === "review" ? "Waiting since" : "Reviewed by",
              "",
            ].map((h) => (
              <th key={h} className="p-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const c = Object.values(
              (t.counts ?? {}) as Record<string, { existing: number; new: number }>,
            )[0];
            const missing = ((t.missing_setup ?? []) as unknown[]).length;
            return (
              <tr
                key={t.id}
                onClick={() => onOpen(t.id)}
                className="cursor-pointer border-t hover:bg-muted/50"
              >
                <td className="p-3 font-semibold">{t.ticket_no}</td>
                <td className="p-3">{t.brand_activity}</td>
                <td className="p-3">{t.owner}</td>
                <td className="p-3">
                  {((t.entities ?? []) as { code: string }[]).map((e) => e.code).join(", ")}
                </td>
                <td className="p-3 tabular-nums">{c ? `${c.existing} + ${c.new} new` : ""}</td>
                <td className="p-3">
                  <TicketStatusBadge status={t.status} />
                  {missing > 0 && mode === "review" && (
                    <span className="ml-2 text-xs font-semibold text-destructive">
                      {missing} missing setup
                    </span>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {mode === "review"
                    ? fmtDate(t.submitted_at)
                    : `${t.reviewer}, ${fmtDate(t.proceeded_at)}`}
                </td>
                <td className={cn("p-3 text-right text-primary")}>Open</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
