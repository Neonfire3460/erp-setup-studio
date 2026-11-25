import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { headFor } from "@/lib/v3/page";
import { listMyTickets } from "@/lib/v3/wizard.functions";
import { Empty, PageHeader, TicketStatusBadge, fmtDate } from "@/components/v3/ui";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/nmk/dates";

export const Route = createFileRoute("/_authenticated/my-submissions/")({
  head: () => headFor("My Submissions", "Your item registration tickets and their status."),
  component: MySubmissions,
});

type Counts = Record<string, { existing: number; new: number }>;

function MySubmissions() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => listMyTickets(),
    refetchInterval: 60000,
  });
  const list = data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Submissions"
        description="Each status change is also emailed to you."
        actions={
          <Button
            onClick={() =>
              navigate({ to: "/item-registration/standard", search: { ticket: undefined } })
            }
          >
            New registration
          </Button>
        }
      />
      {!isLoading && !list.length ? (
        <Empty icon={Inbox} text="You haven't started a registration yet." />
      ) : (
        <div className="overflow-auto rounded-[10px] border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Entities</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Instructions / reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => {
                const c = Object.values((t.counts ?? {}) as Counts)[0];
                const ents = ((t.entities ?? []) as { code: string; costCurrency: string }[])
                  .map((e) => e.code)
                  .join(", ");
                const open = () =>
                  t.status === "draft"
                    ? navigate({ to: "/item-registration/standard", search: { ticket: t.id } })
                    : navigate({ to: "/my-submissions/$id", params: { id: t.id } });
                return (
                  <TableRow
                    key={t.id}
                    onClick={open}
                    className={cn(
                      "cursor-pointer",
                      t.status === "rejected" && "bg-destructive-soft/60 hover:bg-destructive-soft",
                      t.status === "on_hold" && "bg-warning-soft/60 hover:bg-warning-soft",
                    )}
                  >
                    <TableCell className="font-semibold">{t.ticket_no ?? "Draft"}</TableCell>
                    <TableCell>{t.brand_activity}</TableCell>
                    <TableCell>{ents}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.kind === "status_change"
                        ? `${(c as { changes?: number } | undefined)?.changes ?? 0} Active/Inactive`
                        : c
                          ? `${c.existing} + ${c.new} new`
                          : ""}
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.submitted_at ? fmtDate(t.submitted_at) : `Step ${t.step} of 7`}
                      {t.needed_by && (
                        <span className="block text-xs text-muted-foreground">
                          needed by {fmtDay(t.needed_by)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "max-w-80 truncate",
                        t.status === "rejected" && "font-semibold text-destructive",
                      )}
                    >
                      {t.status === "rejected" ? t.reject_reason : t.special_instructions}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
