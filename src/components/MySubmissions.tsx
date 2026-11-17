import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { submissionsQuery } from "@/lib/workflow.queries";
import { deleteSubmission, processSubmissionFn } from "@/lib/submissions.functions";
import { statusLabel } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { z } from "zod";
const plan = z.array(z.object({ entity_code: z.string(), cost_currency: z.string() })).catch([]);
const counts = z.object({ rows: z.number().default(0) }).catch({ rows: 0 });
export function MySubmissions() {
  const { data } = useSuspenseQuery(submissionsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const remove = useServerFn(deleteSubmission);
  const process = useServerFn(processSubmissionFn);
  async function action(id: string, del: boolean) {
    if (del && !window.confirm("Delete this submission?")) return;
    try {
      if (del) await remove({ data: { id } });
      else await process({ data: { id } });
      await qc.invalidateQueries();
      toast.success(del ? "Submission deleted" : "Submission processed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update submission");
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="nmk-page-heading">My Submissions</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Brand</TableHead>
            <TableHead>Entities</TableHead>
            <TableHead>Rows</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Review comment</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-semibold">{s.brand_activity}</TableCell>
              <TableCell>
                {plan
                  .parse(s.entities)
                  .map((e) => `${e.entity_code} (${e.cost_currency})`)
                  .join(", ")}
              </TableCell>
              <TableCell className="text-right">{counts.parse(s.counts).rows}</TableCell>
              <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge variant="outline">{statusLabel(s.status)}</Badge>
              </TableCell>
              <TableCell>{s.status === "rejected" ? s.review_comment : ""}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void navigate({ to: "/build", search: { reuse: s.id } })}
                  >
                    Use again
                  </Button>
                  {s.status === "submitted" && (
                    <Button variant="outline" size="sm" onClick={() => void action(s.id, false)}>
                      Retry processing
                    </Button>
                  )}
                  {s.status !== "approved" && (
                    <Button variant="ghost" size="sm" onClick={() => void action(s.id, true)}>
                      Delete
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!data.length && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No submissions yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
