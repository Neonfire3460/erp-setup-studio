import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { headFor } from "@/lib/v3/page";
import { myTicket, resubmitTicket } from "@/lib/v3/wizard.functions";
import {
  Card,
  Label11,
  PageHeader,
  TicketStatusBadge,
  errText,
  fmtDate,
  fmtNum,
} from "@/components/v3/ui";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_LABEL, type TicketStatus } from "@/lib/nmk/types";

export const Route = createFileRoute("/_authenticated/my-submissions/$id")({
  head: () => headFor("Submission", "Your item registration ticket."),
  component: TicketView,
});

const FLOW: TicketStatus[] = [
  "submitted",
  "in_review",
  "awaiting_approval",
  "approved",
  "uploaded",
  "verified",
];
const ACTION: Record<string, string> = {
  submit: "Submitted",
  start_review: "Review started",
  proceed: "Sent for approval",
  hold: "On hold",
  approve: "Approved",
  reject: "Rejected",
  mark_uploaded: "Uploaded to the ERP",
  verify: "Verified in the ERP",
};

function TicketView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["my-ticket", id],
    queryFn: () => myTicket({ data: { id } }),
  });
  if (error) return <p className="text-sm text-destructive">{errText(error)}</p>;
  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading...
      </div>
    );
  const t = data.ticket;
  const ents = (t.entities ?? []) as { code: string; costCurrency: string; ownCost: boolean }[];
  const suppliers = (t.suppliers ?? []) as {
    entityCode: string;
    supplierName: string;
    supplierCode: string;
    answer: string;
    newName?: string;
  }[];
  const at = FLOW.indexOf(t.status as TicketStatus);

  async function resubmit() {
    try {
      const r = await resubmitTicket({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
      navigate({ to: "/item-registration/standard", search: { ticket: r.id } });
    } catch (e) {
      toast.error(errText(e));
    }
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/my-submissions" })}>
        <ArrowLeft />
        My Submissions
      </Button>
      <PageHeader
        title={`${t.ticket_no ?? "Ticket"} · ${t.brand_activity}`}
        description={`Submitted ${fmtDate(t.submitted_at)}`}
        actions={
          <>
            <TicketStatusBadge status={t.status} />
            {t.status === "rejected" && (
              <Button onClick={resubmit}>
                <RotateCcw />
                Resubmit
              </Button>
            )}
          </>
        }
      />
      {t.status === "rejected" && (
        <Card className="border-destructive/30 bg-destructive-soft text-sm text-destructive">
          <b>Rejected:</b> {t.reject_reason}
        </Card>
      )}
      {t.status === "on_hold" && (
        <Card className="border-warning/30 bg-warning-soft text-sm text-warning">
          On hold: the admin team is checking a few details. You don't need to do anything.
        </Card>
      )}
      {at >= 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {FLOW.map((s, i) => (
            <span
              key={s}
              className={
                i <= at
                  ? "rounded-full bg-accent px-3 py-1 font-semibold text-primary"
                  : "rounded-full bg-muted px-3 py-1 text-muted-foreground"
              }
            >
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 text-sm">
          <Label11>Details</Label11>
          <p>
            <span className="text-muted-foreground">Entities:</span>{" "}
            {ents.map((e) => `${e.code} (cost in ${e.costCurrency})`).join(", ")}
          </p>
          <p>
            <span className="text-muted-foreground">Suppliers:</span>{" "}
            {suppliers
              .map(
                (s) =>
                  `${s.entityCode}: ${s.answer === "different" ? `${s.newName} (changed)` : s.supplierName || s.supplierCode}`,
              )
              .join(", ")}
          </p>
          {t.special_instructions && (
            <p>
              <span className="text-muted-foreground">Special instructions:</span>{" "}
              {t.special_instructions}
            </p>
          )}
        </Card>
        <Card className="space-y-2 text-sm">
          <Label11>History</Label11>
          {data.events.map((e, i) => (
            <p key={i}>
              <span className="text-muted-foreground">{fmtDate(e.at)}</span> ·{" "}
              {ACTION[e.action] ?? e.action}
              {e.action === "reject" && e.comment ? `: ${e.comment}` : ""}
            </p>
          ))}
        </Card>
      </div>
      <Card className="space-y-3">
        <Label11>Items ({data.items.length})</Label11>
        <div className="max-h-[480px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>New or existing</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={i.line_no}>
                  <TableCell className="font-semibold">{i.item_code}</TableCell>
                  <TableCell className="max-w-[480px] truncate">
                    {i.description}
                    {i.use_vendor_description ? " (vendor's description)" : ""}
                  </TableCell>
                  <TableCell>{i.is_new ? "New" : "Existing"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.price_on_request ? "Price on request" : fmtNum(i.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
