import { useEffect, useState } from "react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { cellValue } from "@/lib/sheetParser";
import { UploadArea } from "@/components/UploadArea";

const HEADERS: [string, string][] = [
  ["Item Code", "item_code"], ["Family Name", "family_name"], ["Group Name", "group_name"],
  ["Category Name", "category_name"], ["Sub Category Name", "sub_category_name"], ["Midwich Family", "midwich_family"],
  ["Measurement Unit", "measurement_unit"], ["Inactive", "inactive"], ["Webactive", "webactive"], ["B2B", "b2b"],
];
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function ErpItemsAdmin() {
  const [count, setCount] = useState<number | null>(null);
  const [refreshed, setRefreshed] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { count } = await supabase.from("erp_items").select("*", { count: "exact", head: true });
    setCount(count ?? 0);
    const { data } = await supabase.from("erp_items").select("refreshed_at").order("refreshed_at", { ascending: false }).limit(1);
    setRefreshed(data?.[0]?.refreshed_at ?? null);
  }
  useEffect(() => { load(); }, []);

  async function onFile(file: File) {
    setBusy(true);
    setStatus("Reading file...");
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0];
      if (!ws) throw new Error("The workbook has no sheets");
      const headerRow = ws.getRow(1);
      const colOf: Record<string, number> = {};
      headerRow.eachCell((cell, col) => {
        const v = cellValue(cell.value);
        if (v != null) colOf[norm(String(v))] = col;
      });
      const missing = HEADERS.filter(([h]) => !colOf[norm(h)]).map(([h]) => h);
      if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);

      const now = new Date().toISOString();
      const byCode = new Map<string, Record<string, string | null>>();
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const rec: Record<string, string | null> = {};
        HEADERS.forEach(([h, key]) => {
          const v = cellValue(row.getCell(colOf[norm(h)] as number).value);
          rec[key] = v == null ? null : String(v);
        });
        const code = rec["item_code"]?.trim().toUpperCase();
        if (!code) continue;
        rec["item_code"] = code;
        byCode.set(code, rec);
      }
      const items = [...byCode.values()].map((x) => ({ ...x, item_code: x["item_code"] as string, refreshed_at: now }));
      if (!items.length) throw new Error("No item rows found");
      if (!confirm(`Replace all ERP master data with ${items.length} items?`)) { setStatus(null); setBusy(false); return; }

      const batchId = crypto.randomUUID();
      const chunk = 1000;
      try {
        for (let i = 0; i < items.length; i += chunk) {
          setStatus(`Staging ${Math.min(i + chunk, items.length)} of ${items.length}...`);
          const ins = await supabase.from("erp_items_staging").insert(items.slice(i, i + chunk).map(item => ({ ...item, batch_id: batchId })));
          if (ins.error) throw new Error(ins.error.message);
        }
        setStatus("Replacing ERP master data...");
        const swap = await supabase.rpc("replace_erp_items", { _batch_id: batchId, _expected_count: items.length });
        if (swap.error) throw new Error(swap.error.message);
      } finally {
        await supabase.from("erp_items_staging").delete().eq("batch_id", batchId);
      }
      setStatus(`Done: ${items.length} items loaded.`);
      toast.success("ERP master data replaced");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setStatus(msg);
      toast.error(msg);
    }
    setBusy(false);
    load();
  }

  return (
    <div className="max-w-xl space-y-3">
      <p className="text-sm">
        Rows: <strong>{count ?? "..."}</strong> · Last refresh: <strong>{refreshed ? new Date(refreshed).toLocaleString() : "never"}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        Upload an Excel export with the headers: {HEADERS.map((h) => h[0]).join(", ")}. It replaces all rows.
      </p>
      <UploadArea disabled={busy} onFile={f => void onFile(f)} />
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}
