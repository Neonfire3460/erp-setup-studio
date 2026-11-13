import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
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
  return <div className="space-y-6 min-w-0"><div className="flex justify-between"><h1 className="text-xl font-semibold">History</h1><Button variant="outline" onClick={() => refetch()}>Refresh</Button></div><section className="space-y-3"><h2 className="font-medium">Uploads</h2><Table><TableHeader><TableRow>{["Date", "Tool", "File", "Brand", "Currency", "Owner", "Original"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data.uploads.map(u => <TableRow key={u.id}><TableCell className="whitespace-nowrap">{new Date(u.created_at).toLocaleString()}</TableCell><TableCell>{u.tool}</TableCell><TableCell>{u.file_name}</TableCell><TableCell>{u.brand_activity}</TableCell><TableCell>{u.vendor_currency}</TableCell><TableCell className="max-w-40 break-all">{u.user_id}</TableCell><TableCell>{u.file_path ? control(u.id, u.file_name ?? "original.xlsx", u.file_path) : "—"}</TableCell></TableRow>)}</TableBody></Table>{!data.uploads.length && <p className="text-sm text-muted-foreground">No uploads yet.</p>}</section><section className="space-y-3"><h2 className="font-medium">Exports</h2><Table><TableHeader><TableRow>{["Date", "Entity", "Brand", "Rows", "Owner", "Excel"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data.exports.map(e => <TableRow key={e.id}><TableCell className="whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell><TableCell>{e.entity_code}</TableCell><TableCell>{e.uploads?.brand_activity}</TableCell><TableCell>{e.row_count}</TableCell><TableCell className="max-w-40 break-all">{e.user_id}</TableCell><TableCell>{control(e.id, exportFilename(e.entity_code, e.uploads?.brand_activity ?? "export", e.created_at.slice(0,10)))}</TableCell></TableRow>)}</TableBody></Table>{!data.exports.length && <p className="text-sm text-muted-foreground">No exports yet.</p>}</section></div>;
}