// A3 Upload: approved tickets. Download the ERP file per entity, upload it to the ERP outside the site,
// then Mark as uploaded. After the next ERP import of that entity the site cross-checks and marks Verified in ERP.
import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  ConfirmDialog,
  Empty,
  Label11,
  PageHeader,
  TicketStatusBadge,
  errText,
  fmtDate,
} from "@/components/v3/ui";
import { headFor, downloadBlob, XLSX_TYPE } from "@/lib/v3/page";
import { buildErpWorkbook, erpFileName } from "@/lib/nmk/erpFile";
import { markUploaded, staffQueue, ticketErpRows } from "@/lib/v3/tickets.functions";
import type { Mismatch } from "@/lib/nmk/crossCheck";

export const Route = createFileRoute("/_authenticated/upload")({
  beforeLoad: ({ context }) => {
    if (!context.isReviewer) throw redirect({ to: "/home" });
  },
  head: () => headFor("Upload", "Download approved ERP files and mark them as uploaded."),
  component: Page,
});

type Q = Awaited<ReturnType<typeof staffQueue>>[number];
type Check = {
  perEntity?: { entityCode: string; total: number; matched: number; notInErp: number }[];
  mismatches?: Mismatch[];
  waiting?: string[];
  checkedAt?: string;
} | null;

async function download(id: string, only?: string) {
  const [XLSX, d] = await Promise.all([import("xlsx"), ticketErpRows({ data: { id } })]);
  const sheets = d.sheets.filter((s) => !only || s.entityCode === only);
  for (const s of sheets) {
    if (d.kind === "status_change") {
      // Active/Inactive ticket: two columns only. Inactive 0 = active, 1 = inactive.
      const ws = XLSX.utils.json_to_sheet(
        s.rows.map((r) => ({
          "Item Code": String(r["Item Code"] ?? ""),
          Inactive: Number(r["Inactive"] ?? 0),
        })),
        { header: ["Item Code", "Inactive"] },
      );
      ws["!cols"] = [{ wch: 28 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, s.entityCode);
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      downloadBlob(
        new Blob([buf], { type: XLSX_TYPE }),
        `${d.ticketNo} ${d.brand} ${s.entityCode} Active-Inactive.xlsx`.replace(
          /[\\/:*?"<>|]+/g,
          "-",
        ),
      );
      continue;
    }
    const buf = buildErpWorkbook(XLSX as never, [{ name: s.name, rows: s.rows }]) as ArrayBuffer;
    downloadBlob(new Blob([buf], { type: XLSX_TYPE }), erpFileName(d.ticketNo, s.name, d.brand));
  }
}

function Page() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"todo" | "uploaded">("todo");
  const [busy, setBusy] = useState<string | null>(null);
  const [mark, setMark] = useState<{ t: Q; code: string } | null>(null);
  const q = useQuery({
    queryKey: ["staff-queue", "upload"],
    queryFn: () => staffQueue({ data: { view: "upload" } }),
  });
  const rows = (q.data ?? []).filter((t) =>
    tab === "todo" ? t.status === "approved" : t.status === "uploaded",
  );

  const run = async (key: string, f: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await f();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload"
        description="Download the ERP file for each entity, upload it to the ERP, then mark it as uploaded. Only you can download these files."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "todo" | "uploaded")}>
        <TabsList>
          <TabsTrigger value="todo">
            To upload ({(q.data ?? []).filter((t) => t.status === "approved").length})
          </TabsTrigger>
          <TabsTrigger value="uploaded">
            Waiting for ERP check ({(q.data ?? []).filter((t) => t.status === "uploaded").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {q.isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </p>
      )}
      {q.error && <p className="text-sm text-destructive">{errText(q.error)}</p>}
      {!q.isLoading && !rows.length && (
        <Empty
          icon={FileSpreadsheet}
          text={
            tab === "todo"
              ? "Nothing to upload. Approved tickets appear here."
              : "No uploaded tickets are waiting for an ERP check."
          }
        />
      )}
      {rows.map((t) => {
        const ents = (t.entities ?? []) as unknown as { code: string; name?: string }[];
        const ups = (t.uploads ?? {}) as Record<string, { at: string }>;
        const check = t.cross_check as unknown as Check;
        const counts = (t.counts ?? {}) as Record<string, { existing: number; new: number }>;
        return (
          <Card key={t.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">
                  {t.ticket_no} · {t.brand_activity} <TicketStatusBadge status={t.status} />
                  {t.kind === "status_change" && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      Active/Inactive
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  From {t.owner}
                  {t.approver ? `, approved by ${t.approver}` : ""} {fmtDate(t.decided_at)}
                  {t.uploaded_at ? `, uploaded ${fmtDate(t.uploaded_at)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link to="/review/$id" params={{ id: t.id }}>
                    Open ticket
                  </Link>
                </Button>
                {ents.length > 1 && (
                  <Button
                    disabled={busy !== null}
                    onClick={() => run(`${t.id}-all`, () => download(t.id))}
                  >
                    {busy === `${t.id}-all` ? <Loader2 className="animate-spin" /> : <Download />}
                    Download all ({ents.length} files)
                  </Button>
                )}
              </div>
            </div>
            <div className="divide-y rounded-lg border">
              {ents.map((e) => {
                const up = ups[e.code];
                const c = counts[e.code];
                const pe = check?.perEntity?.find((p) => p.entityCode === e.code);
                return (
                  <div
                    key={e.code}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="text-sm">
                      <p className="font-semibold">
                        {e.name ?? e.code}{" "}
                        <span className="font-normal text-muted-foreground">({e.code})</span>
                      </p>
                      <p className="text-muted-foreground">
                        {t.kind === "status_change"
                          ? `${(c as { changes?: number } | undefined)?.changes ?? 0} Active/Inactive changes (Item Code + Inactive)`
                          : c
                            ? `${c.existing} existing + ${c.new} new items`
                            : ""}
                        {up ? ` · uploaded ${fmtDate(up.at)}` : ""}
                        {pe ? ` · ERP check: ${pe.matched} of ${pe.total} match` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => run(`${t.id}-${e.code}`, () => download(t.id, e.code))}
                      >
                        {busy === `${t.id}-${e.code}` ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Download />
                        )}
                        Download
                      </Button>
                      {t.status === "approved" &&
                        (up ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-success">
                            <CheckCircle2 className="size-4" />
                            Uploaded
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => setMark({ t, code: e.code })}
                          >
                            <Upload />
                            Mark as uploaded
                          </Button>
                        ))}
                      {t.status === "uploaded" && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            to="/erp-import"
                            search={{ entity: e.code, brand: t.brand_activity }}
                          >
                            Import {e.code} ERP data
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {t.status === "uploaded" && (
              <div className="rounded-lg bg-accent/60 p-3 text-sm">
                <p className="font-semibold">To do: import the ERP data</p>
                <p className="text-muted-foreground">
                  Export {t.brand_activity} (or everything) from the ERP for{" "}
                  {ents.map((e) => e.code).join(", ")} and import it on the ERP data import page.
                  The site then checks every row and marks this ticket Verified in ERP.
                </p>
                {check?.waiting?.length ? (
                  <p className="mt-1 text-muted-foreground">
                    Still waiting for: {check.waiting.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
            {!!check?.mismatches?.length && (
              <div className="space-y-2">
                <Label11>
                  Differences found in the last ERP check ({check.mismatches.length})
                </Label11>
                <div className="max-h-72 overflow-auto rounded-lg border">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0 bg-muted text-left text-[11px] font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2">Entity</th>
                        <th className="p-2">Item Code</th>
                        <th className="p-2">Column</th>
                        <th className="p-2">Ticket</th>
                        <th className="p-2">ERP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {check.mismatches.map((m, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{m.entityCode}</td>
                          <td className="p-2 font-semibold">{m.itemCode}</td>
                          <td className="p-2">{m.column}</td>
                          <td className="p-2">{m.ticket}</td>
                          <td className="p-2 text-destructive">{m.erp || "(not in ERP)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fix these in the ERP, then import the entity again.
                </p>
              </div>
            )}
          </Card>
        );
      })}
      <ConfirmDialog
        open={!!mark}
        title={`Mark ${mark?.code} as uploaded?`}
        description={`Only do this after the ${mark?.t.ticket_no} file for ${mark?.code} is in the ERP. When every entity is marked, ${mark?.t.owner || "the user"} gets an email.`}
        confirm="Mark as uploaded"
        onClose={() => setMark(null)}
        onConfirm={async () => {
          if (!mark) return;
          try {
            const r = await markUploaded({ data: { id: mark.t.id, entityCode: mark.code } });
            toast.success(
              r.status === "uploaded"
                ? `${mark.t.ticket_no} is uploaded to the ERP`
                : `${r.done} of ${r.of} entities uploaded`,
            );
            setMark(null);
            await qc.invalidateQueries();
          } catch (e) {
            toast.error(errText(e));
          }
        }}
      />
    </div>
  );
}
