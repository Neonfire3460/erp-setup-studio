import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { historyOptions } from "@/lib/buildQueries";
import { getExportRows } from "@/lib/build.functions";
import { erpBlob, downloadBlob, exportFilename } from "@/lib/buildExcel";
import type { ErpRow } from "@/lib/buildTypes";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function HistoryView() {
  const { data, refetch } = useSuspenseQuery(historyOptions);
  const getRows = useServerFn(getExportRows);
  const [files, setFiles] = useState<Record<string, Blob>>({});
  const [busy, setBusy] = useState("");
  async function prepare(id: string, path?: string | null) {
    setBusy(id);
    try {
      let blob: Blob;
      if (path) { const result = await supabase.storage.from("pricelists").download(path); if (result.error) throw new Error("Original file unavailable"); blob = result.data; }
      else { const rows = await getRows({ data: { id } }); if (!Array.isArray(rows)) throw new Error("Export rows unavailable"); blob = await erpBlob(rows as unknown as ErpRow[]); }
      setFiles(f => ({ ...f, [id]: blob }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); }
    finally { setBusy(""); }
  }
  function control(id: string, name: string, path?: string | null) {
    const blob = files[id];
    return <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => blob ? downloadBlob(blob, name) : prepare(id, path)}><Download />{blob ? "Download" : busy === id ? "Preparing..." : "Prepare download"}</Button>;
  }
  return <div className="space-y-6 min-w-0"><div className="flex justify-between"><div><h1 className="nmk-page-heading">History</h1><p className="mt-1 text-sm text-muted-foreground">Your uploaded files and saved ERP exports.</p></div><Button variant="outline" onClick={() => refetch()}>Refresh</Button></div><section className="space-y-3"><h2 className="font-medium">Uploads</h2><Table><TableHeader><TableRow>{["Date", "Tool", "File", "Brand", "Currency", "Owner", "Original"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data.uploads.map(u => <TableRow key={u.id}><TableCell className="whitespace-nowrap">{new Date(u.created_at).toLocaleString()}</TableCell><TableCell>{u.tool}</TableCell><TableCell>{u.file_name}</TableCell><TableCell>{u.brand_activity}</TableCell><TableCell>{u.vendor_currency}</TableCell><TableCell className="max-w-40 break-all">{u.user_id}</TableCell><TableCell>{u.file_path ? control(u.id, u.file_name ?? "original.xlsx", u.file_path) : "—"}</TableCell></TableRow>)}</TableBody></Table>{!data.uploads.length && <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><span className="rounded-full bg-accent p-4 text-primary"><FolderOpen /></span><p>No uploads yet.</p></div>}</section><section className="space-y-3"><h2 className="font-medium">Exports</h2><Table><TableHeader><TableRow>{["Date", "Entity", "Brand", "Rows", "Owner", "Excel"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data.exports.map(e => <TableRow key={e.id}><TableCell className="whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell><TableCell>{e.entity_code}</TableCell><TableCell>{e.uploads?.brand_activity}</TableCell><TableCell className="text-right tabular-nums">{e.row_count}</TableCell><TableCell className="max-w-40 break-all">{e.user_id}</TableCell><TableCell>{control(e.id, exportFilename(e.entity_code, e.uploads?.brand_activity ?? "export", e.created_at.slice(0,10)))}</TableCell></TableRow>)}</TableBody></Table>{!data.exports.length && <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><span className="rounded-full bg-accent p-4 text-primary"><Download /></span><p>No exports yet.</p></div>}</section></div>;
}