// ERP data import (A4): one entity's export. Finds the brands in the file and replaces only those brands.
// Then cross-checks Uploaded tickets of those brands, which become Verified in ERP when everything matches.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadArea } from "@/components/UploadArea";
import { Card, Label11, Stat, errText, fmtDate } from "@/components/v3/ui";
import {
  brandSummary,
  diffErp,
  erpItemToRow,
  readCostFile,
  withCosts,
  type ErpItem,
  type ReadErpResult,
} from "@/lib/nmk/erp";
import { brandSpelling, mergeBrandSpellings } from "@/lib/nmk/brands";
import type { CategoryRow } from "@/lib/nmk/categories";
import { crossCheckTickets } from "@/lib/v3/tickets.functions";
import { storedForBrands } from "@/lib/v3/erp.functions";

type Entity = { code: string; name: string };
type Hist = {
  id: string;
  entity_code: string;
  imported_at: string;
  file_name: string | null;
  brands: string[];
  mode: string;
  row_count: number;
  active: boolean;
  counts: unknown;
};
type Diff = {
  stored: number;
  added: number | null;
  changed: number | null;
  removed: number | null;
  allBrands: boolean;
};
type Check = Awaited<ReturnType<typeof crossCheckTickets>>;

function parseInWorker(
  file: File,
  entityCode: string,
  categories: CategoryRow[],
  currencyByBrand: Record<string, string>,
  onParsed: (n: number) => void,
) {
  return new Promise<ReadErpResult>((resolve, reject) => {
    const w = new Worker(new URL("../../lib/nmk/erpImport.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "parsed") onParsed(m.rowCount);
      else {
        w.terminate();
        if (m.type === "done") resolve(m.result);
        else reject(new Error(m.message));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "Could not read the file"));
    };
    w.postMessage({ file, entityCode, categories, currencyByBrand });
  });
}

async function all<T>(
  q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  for (let a = 0; ; a += 1000) {
    const r = await q(a, a + 999);
    if (r.error) throw new Error(r.error.message);
    out.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) return out;
  }
}

export function ErpImport({
  initialEntity,
  focusBrand,
}: {
  initialEntity?: string | undefined;
  focusBrand?: string | undefined;
}) {
  const qc = useQueryClient();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [stats, setStats] = useState<Record<string, { rows: number; active: number }>>({});
  const [history, setHistory] = useState<Hist[]>([]);
  const [entity, setEntity] = useState(initialEntity ?? "001");
  const [file, setFile] = useState<File | null>(null);
  const [base, setBase] = useState<ReadErpResult | null>(null);
  const [stored, setStored] = useState<{
    stored: number;
    items: ErpItem[] | null;
    allBrands: boolean;
  } | null>(null);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [costs, setCosts] = useState<Map<string, number> | null>(null);
  // The export, with the cost file's prices when one was added (NMK sends cost as a second file).
  const res = useMemo(
    () => (base && costs && costFile ? withCosts(base, costs, costFile.name) : base),
    [base, costs, costFile],
  );
  const diff = useMemo<Diff | null>(() => {
    if (!res || !stored) return null;
    if (!stored.items)
      return {
        stored: stored.stored,
        added: null,
        changed: null,
        removed: null,
        allBrands: stored.allBrands,
      };
    const d = diffErp(stored.items, res.items);
    return {
      stored: stored.stored,
      added: d.added.length,
      changed: d.changed.length,
      removed: d.removed.length,
      allBrands: false,
    };
  }, [res, stored]);
  const setRes = (r: ReadErpResult | null) => setBase(r);
  const setDiff = (d: null) => setStored(d);
  const [okMissing, setOkMissing] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);

  async function load() {
    const [e, s, h] = await Promise.all([
      supabase.from("entities").select("code,name").eq("active", true).order("sort_order"),
      supabase.rpc("erp_entity_stats"),
      supabase
        .from("erp_imports")
        .select("id,entity_code,imported_at,file_name,brands,mode,row_count,active,counts")
        .order("imported_at", { ascending: false })
        .limit(30),
    ]);
    if (e.error || s.error || h.error) {
      toast.error(e.error?.message ?? s.error?.message ?? h.error?.message ?? "Could not load");
      return;
    }
    setEntities(e.data);
    setStats(
      Object.fromEntries(
        s.data.map((x) => [
          x.entity_code,
          { rows: Number(x.row_count), active: Number(x.active_count) },
        ]),
      ),
    );
    setHistory(h.data as Hist[]);
  }
  useEffect(() => {
    void load();
  }, []);

  async function read(f: File) {
    setFile(f);
    setRes(null);
    setDiff(null);
    setCheck(null);
    setOkMissing(false);
    setBusy(true);
    setStatus("Reading the file...");
    try {
      const [cats, mw, brands] = await Promise.all([
        all<{
          family_code: string;
          family_name: string;
          group_code: string;
          group_name: string;
          category_code: string;
          category_name: string;
          sub_category_code: string;
          midwich_code: string;
        }>((a, b) =>
          supabase
            .from("categories")
            .select(
              "family_code,family_name,group_code,group_name,category_code,category_name,sub_category_code,midwich_code",
            )
            .range(a, b),
        ),
        supabase
          .from("midwich_families")
          .select("code,name")
          .then((r) => r.data ?? []),
        supabase
          .from("brands")
          .select("brand_activity,last_currency")
          .then((r) => r.data ?? []),
      ]);
      const mwName = new Map(mw.map((m) => [m.code, m.name]));
      const categories: CategoryRow[] = cats.map((c) => ({
        familyCode: c.family_code,
        familyName: c.family_name,
        groupCode: c.group_code,
        groupName: c.group_name,
        categoryCode: c.category_code,
        categoryName: c.category_name,
        subCategoryCode: c.sub_category_code,
        midwichCode: c.midwich_code,
        midwichName: mwName.get(c.midwich_code) ?? "",
        reviewNote: "",
      }));
      const currencyByBrand = Object.fromEntries(
        brands
          .filter((b) => b.last_currency)
          .flatMap((b) => [
            [b.brand_activity, b.last_currency!],
            [b.brand_activity.toUpperCase(), b.last_currency!],
            [
              b.brand_activity.charAt(0) + b.brand_activity.slice(1).toLowerCase(),
              b.last_currency!,
            ],
          ]),
      );
      const r = await parseInWorker(f, entity, categories, currencyByBrand, (n) =>
        setStatus(`Read ${n.toLocaleString()} rows. Checking columns...`),
      );
      setRes(r);
      if (!r.ok) {
        setStatus("Import stopped: fix the problems below.");
        return;
      }
      setStatus("Comparing with the stored data...");
      const cmp = await storedForBrands({
        data: { entityCode: entity, brands: r.brands.map((b) => b.brand) },
      });
      setStored(cmp);
      setStatus("");
    } catch (e) {
      setStatus(errText(e));
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function readCost(f: File) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, {
        header: 1,
        defval: null,
      });
      const r = readCostFile(rows);
      if (r.problem) {
        toast.error(r.problem);
        return;
      }
      setCostFile(f);
      setCosts(r.costs);
      toast.success(`${r.costs.size.toLocaleString()} cost prices read from ${f.name}`);
    } catch (e) {
      toast.error(errText(e));
    }
  }

  async function purge(id: string) {
    for (;;) {
      const r = await supabase.rpc("delete_erp_import_rows", { _import_id: id });
      if (r.error || !r.data) return;
    }
  }

  async function runImport() {
    if (!res || !diff) return;
    setBusy(true);
    setCheck(null);
    setProgress(0);
    let importId: string | null = null;
    let merged = false;
    try {
      // Save the brand as the brands table already spells it ("NEAT" in the file -> "Neat"), so the site keeps one.
      const known = await supabase.from("brands").select("brand_activity,logo_path");
      const spell = brandSpelling(
        mergeBrandSpellings(known.data ?? []).map((b) => b.brand_activity),
      );
      const items = res.items.map((i) => (i.brand ? { ...i, brand: spell(i.brand) } : i));
      const me = (await supabase.auth.getUser()).data.user?.id ?? null;
      const created = await supabase
        .from("erp_imports")
        .insert({
          entity_code: entity,
          file_name: file?.name ?? null,
          row_count: items.length,
          imported_by: me,
          brands: [...new Set(res.brands.map((b) => spell(b.brand)))],
          mode: "merge",
          active: false,
          counts: {
            missingColumns: res.missingColumns.map((m) => m.header),
            added: diff.added,
            changed: diff.changed,
            removed: diff.removed,
            storedBefore: diff.stored,
            demoSkipped: res.demoSkipped,
          },
        })
        .select("id")
        .single();
      if (created.error) throw new Error(`Could not start the import: ${created.error.message}`);
      const id = created.data.id;
      importId = id;
      const size = 1000,
        total = Math.ceil(items.length / size);
      let done = 0,
        next = 0;
      const worker = async () => {
        while (next < total) {
          const k = next++;
          const ins = await supabase
            .from("erp_items")
            .insert(
              items
                .slice(k * size, (k + 1) * size)
                .map((i) => ({ ...erpItemToRow(i), import_id: id })),
            );
          if (ins.error) throw new Error(`Upload failed at batch ${k + 1}: ${ins.error.message}`);
          done++;
          setProgress(Math.round((done / total) * 100));
          setStatus(
            `Uploading ${Math.min(done * size, items.length).toLocaleString()} of ${items.length.toLocaleString()} rows...`,
          );
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      setStatus("Replacing the brands in the file...");
      const m = await supabase.rpc("merge_erp_import", { _import_id: id });
      if (m.error) throw new Error(m.error.message);
      merged = true;
      setStatus("Adding new brands, sub activities and supplier codes...");
      const brands = [...new Set(items.map((i) => i.brand).filter(Boolean))];
      await supabase.from("brands").upsert(
        brands.map((b) => ({ brand_activity: b })),
        { onConflict: "brand_activity", ignoreDuplicates: true },
      );
      const subs = [
        ...new Set(
          items
            .filter((i) => i.brand && i.subActivity)
            .map((i) => `${i.brand}\u0000${i.subActivity}`),
        ),
      ].map((x) => {
        const [b, s] = x.split("\u0000");
        return { brand_activity: b!, sub_activity: s! };
      });
      for (let i = 0; i < subs.length; i += 1000)
        await supabase.from("sub_activities").upsert(subs.slice(i, i + 1000), {
          onConflict: "brand_activity,sub_activity",
          ignoreDuplicates: true,
        });
      const sup = new Map<string, Map<string, number>>();
      for (const i of items)
        if (i.brand && i.supplierCode) {
          const c = sup.get(i.brand) ?? new Map();
          c.set(i.supplierCode, (c.get(i.supplierCode) ?? 0) + 1);
          sup.set(i.brand, c);
        }
      const supRows = [...sup].map(([b, c]) => ({
        brand_activity: b,
        entity_code: entity,
        supplier: [...c].sort((x, y) => y[1] - x[1])[0]![0],
      }));
      for (let i = 0; i < supRows.length; i += 1000)
        await supabase.from("brand_suppliers").upsert(supRows.slice(i, i + 1000), {
          onConflict: "brand_activity,entity_code",
          ignoreDuplicates: true,
        });
      setStatus("Cross-checking uploaded tickets...");
      const c = await crossCheckTickets({ data: { entityCode: entity, brands } });
      setCheck(c);
      setStatus(
        `Done: ${items.length.toLocaleString()} items for ${entity} (${brandSummary(res).replace(/^This file has /, "")}).`,
      );
      toast.success(`ERP data of ${entity} updated`);
      void qc.invalidateQueries();
    } catch (e) {
      const msg = errText(e);
      setStatus(merged ? `${msg} The new data is in.` : `${msg} Nothing was changed.`);
      toast.error(msg);
      if (importId && !merged) {
        await purge(importId);
        await supabase.from("erp_imports").delete().eq("id", importId);
      }
    } finally {
      setBusy(false);
      setProgress(null);
      void load();
    }
  }

  const canImport = !!res?.ok && !!diff && (!res.missingColumns.length || okMissing) && !busy;
  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Label11>Entity</Label11>
            <Select
              value={entity}
              onValueChange={(v) => {
                setEntity(v);
                setRes(null);
                setDiff(null);
                setFile(null);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.code} value={e.code}>
                    {e.code} · {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {stats[entity]
              ? `${stats[entity]!.rows.toLocaleString()} items stored, ${stats[entity]!.active.toLocaleString()} active`
              : "No data stored yet"}
            {focusBrand ? ` · expected brand: ${focusBrand}` : ""}
          </p>
        </div>
        <UploadArea
          file={file}
          onFile={(f) => void read(f)}
          disabled={busy}
          accept=".xlsx,.csv"
          hint="ERP item export, .xlsx or .csv (UTF-8 is best for big files)"
          label="Drop the ERP export here or browse"
          onRemove={() => {
            setFile(null);
            setRes(null);
            setDiff(null);
          }}
        />
        <UploadArea
          file={costFile}
          onFile={(f) => void readCost(f)}
          disabled={busy}
          accept=".xlsx,.csv"
          hint='Optional. When the cost comes as a second file: "Item code" + "Purchase price in currency"'
          label="Drop the cost price file here (optional)"
          onRemove={() => {
            setCostFile(null);
            setCosts(null);
          }}
        />
        {status && (
          <p className="flex items-center gap-2 text-sm">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {status}
          </p>
        )}
        {progress !== null && <Progress value={progress} />}
      </Card>

      {res && (
        <Card className="space-y-3">
          <p className="font-semibold">{brandSummary(res)}</p>
          {focusBrand &&
            !res.brands.some((b) => b.brand.toUpperCase() === focusBrand.toUpperCase()) && (
              <p className="text-sm text-warning">This file doesn't have {focusBrand}.</p>
            )}
          {res.problems.map((p) => (
            <p key={p} className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
              {p}
            </p>
          ))}
          {res.missingColumns.length > 0 && (
            <div className="space-y-2 rounded-lg bg-warning-soft p-3 text-sm">
              <p className="font-semibold text-warning">Columns missing from this export</p>
              <ul className="list-disc pl-5">
                {res.missingColumns.map((m) => (
                  <li key={m.header}>
                    <b>{m.header}</b>: needed for {m.whyNeeded}
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2">
                <Checkbox checked={okMissing} onCheckedChange={(v) => setOkMissing(v === true)} />
                Import anyway (these values stay empty, and the cross-check skips them)
              </label>
            </div>
          )}
          {res.notes.map((n) => (
            <p key={n} className="text-sm text-muted-foreground">
              {n}
            </p>
          ))}
          {res.demoSkipped > 0 && (
            <p className="text-sm text-muted-foreground">{res.demoSkipped} Demo codes skipped.</p>
          )}
          {res.duplicates.length > 0 && (
            <p className="text-sm text-warning">
              {res.duplicates.length} repeated item codes (first row kept):{" "}
              {res.duplicates.slice(0, 8).join(", ")}
              {res.duplicates.length > 8 ? "..." : ""}
            </p>
          )}
          {diff && (
            <>
              {diff.added !== null ? (
                <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
                  <Stat label="New items" value={diff.added} />
                  <Stat label="Changed" value={diff.changed} />
                  <Stat
                    label="No longer in file"
                    value={diff.removed}
                    tone={diff.removed ? "warning" : undefined}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {diff.stored.toLocaleString()} items {diff.allBrands ? "" : "of these brands "}are
                  stored for {entity} now. The file has {res.items.length.toLocaleString()}. A
                  detailed comparison is shown for smaller files.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Only {res.brands.length === 1 ? "this brand is" : "these brands are"} replaced in{" "}
                {entity}. Every other brand stays as it is.
              </p>
              <Button disabled={!canImport} onClick={runImport}>
                <Upload />
                Import
              </Button>
            </>
          )}
        </Card>
      )}

      {check && (
        <Card className="space-y-2">
          <Label11>Cross-check with uploaded tickets</Label11>
          {!check.length && (
            <p className="text-sm text-muted-foreground">
              No uploaded tickets for these brands are waiting for a check.
            </p>
          )}
          {check.map((c) => (
            <p key={c.id} className="flex items-center gap-2 text-sm">
              {c.allMatch ? <CheckCircle2 className="size-4 text-success" /> : null}
              <b>{c.ticketNo}</b>{" "}
              {c.allMatch
                ? `matches the ERP: ${c.matched} of ${c.total} rows. Verified in ERP.`
                : `${c.matched} of ${c.total} rows match${c.mismatches ? `, ${c.mismatches} differences (open the Upload page)` : ""}${c.waiting.length ? `. Still waiting for an import of ${c.waiting.join(", ")}` : ""}.`}
            </p>
          ))}
        </Card>
      )}

      <Card className="space-y-2">
        <Label11>Import history</Label11>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Brands</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(h.imported_at)}</TableCell>
                  <TableCell>{h.entity_code}</TableCell>
                  <TableCell className="max-w-64 truncate">
                    {h.brands.join(", ") || "(all)"}
                  </TableCell>
                  <TableCell className="text-right">{h.row_count.toLocaleString()}</TableCell>
                  <TableCell className="max-w-48 truncate">{h.file_name}</TableCell>
                  <TableCell>{h.active ? "active data" : h.mode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
