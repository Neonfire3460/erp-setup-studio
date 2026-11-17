import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { finishErpImport } from "@/lib/erp.functions";
import type { ErpItem } from "@/lib/excelFiles";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Entity = { code: string; name: string };
type Stat = { rows: number; active: number; last?: { imported_at: string; file_name: string | null } };
type Parsed = { ok: boolean; problems: string[]; items: ErpItem[]; subActivities: [string, string][]; suppliers: [string, string][] };

const toRow = (i: ErpItem, batch_id: string) => ({
  batch_id, entity_code: i.entityCode, item_code: i.itemCode, alternative_code: i.alternativeCode || null, description: i.description || null,
  alternative_description: i.alternativeDescription || null, measurement_unit: i.measurementUnit || null, retail_price: i.retailPrice,
  brand_activity: i.brandActivity || null, sub_activity: i.subActivity || null, family_code: i.familyCode || null, group_code: i.groupCode || null,
  category_code: i.categoryCode || null, sub_category_code: i.subCategoryCode || null, midwich_family_code: i.midwichFamilyCode || null,
  family_name: i.familyName || null, group_name: i.groupName || null, category_name: i.categoryName || null, sub_category_name: i.subCategoryName || null,
  midwich_family_name: i.midwichFamilyName || null, max_discount_pct: i.maxDiscountPct, supplier_code: i.supplierCode || null,
  inactive: i.inactive, webactive: i.webactive, b2b: i.b2b,
});

function parseInWorker(file: File, entityCode: string, onParsed: (n: number) => void) {
  return new Promise<Parsed>((resolve, reject) => {
    const w = new Worker(new URL("../../lib/erpImport.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "parsed") onParsed(m.rowCount);
      else { w.terminate(); m.type === "done" ? resolve(m.result) : reject(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "Could not read the file")); };
    w.postMessage({ file, entityCode });
  });
}

export function ErpDataAdmin() {
  const finish = useServerFn(finishErpImport);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  async function load() {
    const [e, s, imp] = await Promise.all([
      supabase.from("entities").select("code,name").order("sort_order"),
      supabase.rpc("erp_entity_stats"),
      supabase.from("erp_imports").select("entity_code,imported_at,file_name").order("imported_at", { ascending: false }).limit(200),
    ]);
    if (e.error || s.error || imp.error) { toast.error("Could not load ERP data"); return; }
    setEntities(e.data);
    const out: Record<string, Stat> = {};
    for (const x of e.data) {
      const st = s.data.find((r) => r.entity_code === x.code);
      const last = imp.data.find((r) => r.entity_code === x.code);
      out[x.code] = { rows: Number(st?.row_count ?? 0), active: Number(st?.active_count ?? 0), ...(last ? { last } : {}) };
    }
    setStats(out);
  }
  useEffect(() => { void load(); }, []);

  async function importFile(entity: string, file: File) {
    setBusy(entity); setProblems([]); setProgress(null); setStatus("Reading file...");
    const batch = crypto.randomUUID();
    let staged = false;
    try {
      const parsed = await parseInWorker(file, entity, (n) => setStatus(`Read ${n.toLocaleString()} rows. Checking columns...`));
      setProblems(parsed.problems);
      if (!parsed.ok) { setStatus("Import stopped. Fix the problems below and try again."); return; }
      const items = parsed.items;
      if (!items.length) throw new Error("No item rows found");
      if (!confirm(`Replace the ERP data of ${entity} with ${items.length.toLocaleString()} items?`)) { setStatus(""); return; }
      staged = true;
      const size = 1000, total = Math.ceil(items.length / size);
      let done = 0, next = 0;
      setProgress(0);
      const worker = async () => {
        while (next < total) {
          const k = next++;
          const ins = await supabase.from("erp_items_staging").insert(items.slice(k * size, (k + 1) * size).map((i) => toRow(i, batch)));
          if (ins.error) throw new Error(`Staging failed at batch ${k + 1}: ${ins.error.message}`);
          done++; setProgress(Math.round((done / total) * 100));
          setStatus(`Uploading ${Math.min(done * size, items.length).toLocaleString()} of ${items.length.toLocaleString()} rows...`);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      setStatus("Replacing the ERP data in one step...");
      const r = await finish({ data: { entity_code: entity, batch_id: batch, expected_count: items.length, file_name: file.name, sub_activities: parsed.subActivities, suppliers: parsed.suppliers } });
      staged = false;
      setStatus(`Done: ${Number(r.rows).toLocaleString()} items for ${entity}. Added ${r.newBrands} brands, ${r.newSubs} sub activities, ${r.newSuppliers} supplier codes.`);
      toast.success(`ERP data of ${entity} replaced`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setStatus(`${msg} The old rows are unchanged.`); toast.error(msg);
    } finally {
      if (staged) await supabase.from("erp_items_staging").delete().eq("batch_id", batch);
      setBusy(null); setProgress(null); void load();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Upload the ERP item export of one entity (.csv UTF-8 recommended for big files, or .xlsx). It replaces only that entity's rows, all at once. Entities without their own data use the 001 data.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead className="text-right">Rows</TableHead><TableHead className="text-right">Active rows</TableHead><TableHead>Last import</TableHead><TableHead>File</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {entities.map((e) => {
            const s = stats[e.code];
            return (
              <TableRow key={e.code}>
                <TableCell className="font-semibold">{e.code} <span className="font-normal text-muted-foreground">{e.name}</span></TableCell>
                <TableCell className="text-right">{s ? s.rows.toLocaleString() : "..."}</TableCell>
                <TableCell className="text-right">{s ? s.active.toLocaleString() : "..."}</TableCell>
                <TableCell>{s?.last ? new Date(s.last.imported_at).toLocaleString() : "Never"}</TableCell>
                <TableCell className="max-w-56 truncate">{s?.last?.file_name ?? ""}</TableCell>
                <TableCell>
                  <input id={`erp-${e.code}`} type="file" accept=".csv,.xlsx" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) void importFile(e.code, f); }} />
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => document.getElementById(`erp-${e.code}`)?.click()}><Upload />{busy === e.code ? "Importing..." : "Upload"}</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {progress !== null && <Progress value={progress} />}
      {status && <p className="text-sm">{status}</p>}
      {problems.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-warning">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
    </div>
  );
}
