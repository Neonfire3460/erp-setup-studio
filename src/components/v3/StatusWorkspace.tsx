// Reviewer page for an Item Active/Inactive ticket (ST-...). No approver step: Approve sends it straight to
// the Upload page, where the file has two columns, Item Code and Inactive (0 active, 1 inactive).
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  ConfirmDialog,
  Label11,
  PageHeader,
  TextDialog,
  TicketStatusBadge,
  errText,
  fmtDate,
} from "@/components/v3/ui";
import { decideStatus, statusTicket } from "@/lib/v3/status.functions";
import { cn } from "@/lib/utils";
import { DeadlineStrip } from "./Deadline";

export const StateChip = ({ inactive }: { inactive: number | null | undefined }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
      inactive === 1 ? "bg-muted text-muted-foreground" : "bg-success-soft text-success",
    )}
  >
    {inactive === 1 ? "Inactive" : "Active"}
  </span>
);

export function StatusWorkspace({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["status-ticket", id],
    queryFn: () => statusTicket({ data: { id } }),
  });
  const [out, setOut] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);

  if (error) return <p className="text-sm text-destructive">{errText(error)}</p>;
  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading the ticket...
      </div>
    );
  const t = data.ticket;
  const open = ["submitted", "in_review", "on_hold"].includes(t.status);
  const keep = data.changes.filter((c) => !out.has(c.id));
  const toIn = keep.filter((c) => c.inactive_to === 1).length;
  const ents = [...new Set(data.changes.map((c) => c.entity_code))];
  const ename = (c: string) => data.entities.find((e) => e.code === c)?.name ?? c;

  async function decide(approve: boolean, reason = "") {
    try {
      const r = await decideStatus({ data: { id, approve, reason, leaveOut: [...out] } });
      toast.success(
        r.status === "approved"
          ? `${t.ticket_no} approved: it's on the Upload page`
          : `${t.ticket_no} rejected`,
      );
      await qc.invalidateQueries();
      navigate({ to: r.status === "approved" ? "/upload" : "/review" });
    } catch (e) {
      toast.error(errText(e));
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/review">
          <ArrowLeft />
          Review
        </Link>
      </Button>
      <PageHeader
        title={`${t.ticket_no} · ${t.brand_activity}`}
        description={`Active/Inactive request from ${data.owner} · submitted ${fmtDate(t.submitted_at)}${data.reviewer ? ` · reviewer ${data.reviewer}` : ""}`}
        actions={
          <>
            <TicketStatusBadge status={t.status} />
            {open && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setDialog("reject")}
                >
                  <X />
                  Reject
                </Button>
                <Button disabled={!keep.length} onClick={() => setDialog("approve")}>
                  <Check />
                  Approve {keep.length} change{keep.length === 1 ? "" : "s"}
                </Button>
              </>
            )}
          </>
        }
      />
      <DeadlineStrip neededBy={t.needed_by} effectiveFrom={t.effective_from} />
      {t.special_instructions && (
        <Card className="border-primary/30 bg-accent">
          <Label11>Note from {data.owner}</Label11>
          <p className="mt-1 text-sm">{t.special_instructions}</p>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-3xl font-bold">{keep.length}</p>
          <p className="text-sm text-muted-foreground">changes to make</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-muted-foreground">{toIn}</p>
          <p className="text-sm text-muted-foreground">to Inactive (1)</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-success">{keep.length - toIn}</p>
          <p className="text-sm text-muted-foreground">to Active (0)</p>
        </Card>
      </div>
      {ents.map((e) => {
        const list = data.changes.filter((c) => c.entity_code === e);
        return (
          <Card key={e} className="space-y-3">
            <Label11>
              {ename(e)} ({e}) · {list.length}
            </Label11>
            <div className="max-h-[480px] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="w-24 p-2">Include</th>
                    <th className="p-2">Item Code</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr
                      key={c.id}
                      className={cn("border-t", out.has(c.id) && "opacity-40 line-through")}
                    >
                      <td className="p-2">
                        <Checkbox
                          disabled={!open}
                          checked={!out.has(c.id)}
                          onCheckedChange={(v) =>
                            setOut((s) => {
                              const n = new Set(s);
                              if (v === true) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 font-semibold">{c.item_code}</td>
                      <td className="max-w-md truncate p-2" title={c.description}>
                        {c.description}
                      </td>
                      <td className="whitespace-nowrap p-2">
                        <StateChip inactive={c.inactive_from} />
                        <ArrowRight className="mx-1 inline size-3.5 text-muted-foreground" />
                        <StateChip inactive={c.inactive_to} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
      <ConfirmDialog
        open={dialog === "approve"}
        title={`Approve ${keep.length} change${keep.length === 1 ? "" : "s"}?`}
        description={`${out.size ? `${out.size} left out. ` : ""}The file (Item Code + Inactive) goes to the Upload page, and ${data.owner || "the user"} gets an email. No approver step is needed.`}
        confirm="Approve"
        onClose={() => setDialog(null)}
        onConfirm={() => decide(true)}
      />
      <TextDialog
        open={dialog === "reject"}
        title={`Reject ${t.ticket_no}?`}
        description={`${data.owner || "The user"} sees the reason, and the items go back to how they were.`}
        placeholder="Reason (required)"
        required
        confirm="Reject"
        destructive
        onClose={() => setDialog(null)}
        onConfirm={(text) => decide(false, text)}
      />
    </div>
  );
}
