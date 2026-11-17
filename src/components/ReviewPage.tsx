import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { adminQuery, detailQuery } from "@/lib/workflow.queries";
import { processSubmissionFn, reviewAction } from "@/lib/submissions.functions";
import { asChecks, downloadBlob, statusLabel } from "@/lib/workflow";
import { buildErpWorkbook, ERP_HEADERS, type ErpRow } from "@/lib/excelFiles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { CheckTable } from "./CheckTable";
import { z } from "zod";
const count = z
  .object({ rows: z.number().default(0), warnings: z.number().default(0) })
  .catch({ rows: 0, warnings: 0 });
export function ReviewQueue() {
  const { data } = useSuspenseQuery(adminQuery);
  const [approved, setApproved] = useState(false);
  const rows = data.submissions.filter((s) => s.status === (approved ? "approved" : "in_review"));
  return (
    <div className="space-y-6">
      <h1 className="nmk-page-heading">Review Queue</h1>
      <div className="flex gap-2">
        <Button variant={approved ? "outline" : "default"} onClick={() => setApproved(false)}>
          In review
        </Button>
        <Button variant={approved ? "default" : "outline"} onClick={() => setApproved(true)}>
          Approved
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {["Brand", "User", "Entities", "Rows", "Warnings", "Submitted", ""].map((h, i) => (
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-semibold">{s.brand_activity}</TableCell>
              <TableCell>{data.users.find((u) => u.user_id === s.user_id)?.email}</TableCell>
              <TableCell>
                {z
                  .array(z.object({ entity_code: z.string() }))
                  .catch([])
                  .parse(s.entities)
                  .map((e) => e.entity_code)
                  .join(", ")}
              </TableCell>
              <TableCell className="text-right">{count.parse(s.counts).rows}</TableCell>
              <TableCell className="text-right">{count.parse(s.counts).warnings}</TableCell>
              <TableCell>
                {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : ""}
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/review-queue/$id" params={{ id: s.id }}>
                    Open
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No {approved ? "approved submissions" : "submissions in review"}.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
export function ReviewDetail({ id }: { id: string }) {
  const { data } = useSuspenseQuery(detailQuery(id));
  const { data: admin } = useSuspenseQuery(adminQuery);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [blobs, setBlobs] = useState<Record<string, Blob>>({});
  const action = useServerFn(reviewAction);
  const recalc = useServerFn(processSubmissionFn);
  const s = data.submission;
  const entities = admin.entities.filter((e) => data.outputs.some((o) => o.entity_code === e.code));
  const filename = `ERP_${s.brand_activity.replace(/[\\/:*?"<>|]/g, "_")}_${(s.reviewed_at ?? new Date().toISOString()).slice(0, 10)}_${id.slice(0, 8)}.xlsx`;
  const errors = data.outputs.some((o) => asChecks(o.checks).some((c) => c.level === "error"));
  async function prepare() {
    setBusy(true);
    try {
      const ExcelJS = await import("exceljs");
      const sheets = entities.map((e) => ({
        name: e.name,
        rows: data.outputs.filter((o) => o.entity_code === e.code).map((o) => o.values as ErpRow),
      }));
      const all = new Blob([await buildErpWorkbook(ExcelJS, sheets).xlsx.writeBuffer()]);
      const n: Record<string, Blob> = { all };
      for (const e of entities) {
        const sheet = sheets.find((x) => x.name === e.name);
        if (sheet)
          n[e.code] = new Blob([await buildErpWorkbook(ExcelJS, [sheet]).xlsx.writeBuffer()]);
      }
      if (s.status === "approved" && s.output_path) {
        const stored = await supabase.storage.from("erp-outputs").download(s.output_path);
        if (stored.error) throw stored.error;
        n["all"] = stored.data;
      }
      setBlobs(n);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare file");
    } finally {
      setBusy(false);
    }
  }
  async function run(kind: "approve" | "reject" | "recalculate") {
    setBusy(true);
    let path: string | null = null;
    try {
      if (kind === "recalculate") {
        await recalc({ data: { id } });
      } else if (kind === "reject") {
        await action({ data: { id, action: "reject", comment, revision: s.processing_revision } });
      } else {
        const blob = blobs["all"];
        if (!blob) throw new Error("Prepare the ERP file first");
        path = `${id}/${crypto.randomUUID()}/${filename}`;
        const upload = await supabase.storage
          .from("erp-outputs")
          .upload(path, blob, {
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        if (upload.error) throw upload.error;
        await action({ data: { id, action: "approve", path, revision: s.processing_revision } });
      }
      setBlobs({});
      await qc.invalidateQueries();
      toast.success(
        kind === "approve"
          ? "Approved and added to Catalogue"
          : kind === "reject"
            ? "Rejected"
            : "Recalculated",
      );
    } catch (e) {
      if (path) await supabase.storage.from("erp-outputs").remove([path]);
      toast.error(e instanceof Error ? e.message : "Could not update review");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="nmk-page-heading">{s.brand_activity} · Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusLabel(s.status)} · {id.slice(0, 8)} ·{" "}
            {admin.users.find((u) => u.user_id === s.user_id)?.email}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/review-queue">Back to queue</Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {!blobs["all"] ? (
          <Button
            variant="outline"
            disabled={busy || !data.outputs.length}
            onClick={() => void prepare()}
          >
            Prepare ERP file
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              const b = blobs["all"];
              if (b) downloadBlob(b, s.status === "approved" ? filename : `DRAFT_${filename}`);
            }}
          >
            <Download />
            {s.status === "approved" ? "Download ERP file" : "Download draft"}
          </Button>
        )}
        {s.status === "in_review" && (
          <>
            <Button
              disabled={busy || errors || !blobs["all"]}
              title={
                errors
                  ? "Row errors block approval"
                  : !blobs["all"]
                    ? "Prepare the ERP file first"
                    : undefined
              }
              onClick={() => void run("approve")}
            >
              Approve
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void run("recalculate")}>
              Recalculate
            </Button>
            <Input
              aria-label="Rejection comment"
              placeholder="Rejection comment (required)"
              className="w-full bg-card sm:w-72"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={busy || !comment.trim()}
              onClick={() => void run("reject")}
            >
              Reject
            </Button>
          </>
        )}
        {s.status === "needs_pricing" && (
          <Button asChild variant="outline">
            <Link to="/tickets">Open tickets</Link>
          </Button>
        )}
      </div>
      {entities.length > 0 && (
        <Tabs defaultValue={entities[0]?.code ?? ""}>
          <TabsList>
            {entities.map((e) => (
              <TabsTrigger key={e.code} value={e.code}>
                {e.name} · {data.outputs.filter((o) => o.entity_code === e.code).length}
              </TabsTrigger>
            ))}
          </TabsList>
          {entities.map((e) => (
            <TabsContent key={e.code} value={e.code} className="space-y-4">
              {blobs[e.code] && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const b = blobs[e.code];
                    if (b)
                      downloadBlob(
                        b,
                        `${s.status === "approved" ? "" : "DRAFT_"}${e.code}_${filename}`,
                      );
                  }}
                >
                  <Download />
                  Download {e.name}
                </Button>
              )}
              <CheckTable
                columns={[...ERP_HEADERS, "ERP retail now", "Change %"]}
                rows={data.outputs
                  .filter((o) => o.entity_code === e.code)
                  .map((o) => {
                    const values = o.values as ErpRow;
                    const retail = Number(values["Retail Price"]);
                    const change =
                      o.current_erp_retail && o.current_erp_retail > 0
                        ? Math.round(
                            ((retail - o.current_erp_retail) / o.current_erp_retail) * 10000,
                          ) / 100
                        : null;
                    return {
                      key: o.id,
                      values: {
                        ...values,
                        "ERP retail now": o.current_erp_retail,
                        "Change %": change,
                      },
                      checks: asChecks(o.checks),
                      change,
                    };
                  })}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
