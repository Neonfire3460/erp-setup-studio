import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildErpRows, saveBuildExport } from "@/lib/build.functions";
import { buildOptions } from "@/lib/buildQueries";
import { INPUT_HEADERS, ERP_HEADERS, text, type InputRow, type EntityReview } from "@/lib/buildTypes";
import { readInput, templateBlob, rowsBlob, erpBlob, downloadBlob, exportFilename, compareDetected } from "@/lib/buildExcel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Stepper } from "@/components/Stepper";
import { UploadArea } from "@/components/UploadArea";
import { EntityCard } from "@/components/EntityCard";
import { BuildReview } from "@/components/BuildReview";

export function BuildTool() {
  const { data: options } = useSuspenseQuery(buildOptions);
  const build = useServerFn(buildErpRows), save = useServerFn(saveBuildExport);
  const [brand, setBrand] = useState("");
  const [currency, setCurrency] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<InputRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [comparison, setComparison] = useState("");
  const [reviews, setReviews] = useState<EntityReview[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [template, setTemplate] = useState<Blob | null>(null);
  const [downloads, setDownloads] = useState<Record<string, Blob>>({});
  const [problems, setProblems] = useState<Blob | null>(null);
  const brands = [...new Set(options.activities.map(a => a.brand_activity))];
  const currencies = [...new Set(options.activities.filter(a => a.brand_activity === brand).map(a => a.vendor_currency))];
  const available = new Set(options.activities.filter(a => a.brand_activity === brand && a.vendor_currency === currency).flatMap(a => a.entity_codes));
  const regions = [...new Set(options.entities.map(e => e.region))];
  const errorIndices = new Set(reviews.flatMap(e => e.rows.filter(r => r.checks.some(c => c.level === "error")).map(r => r.inputIndex)));
  function resetReview() { setReviews([]); setDownloads({}); setProblems(null); setUploadId(null); }
  async function act(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { const message = e instanceof Error ? e.message : "Build failed"; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    setTemplate(null);
    if (!brand || !currency) return;
    let cancelled = false;
    templateBlob(brand, currency, [...new Set(options.activities.filter(a => a.brand_activity === brand).map(a => a.sub_activity))])
      .then(blob => { if (!cancelled) setTemplate(blob); })
      .catch(() => { if (!cancelled) setError("Could not prepare blank template"); });
    return () => { cancelled = true; };
  }, [brand, currency, options.activities]);
  async function upload(f: File) {
    setFile(null); setRows([]); setComparison(""); resetReview();
    await act(async () => {
      const parsed = await readInput(f);
      setRows(parsed.rows); setFile(f);
      const b = text(parsed.rows[0]?.["Brand Activity"]) || parsed.meta["brand_activity"] || "";
      setBrand(b); setCurrency(parsed.meta["vendor_currency"] ?? ""); setSelected([]); setTemplate(null);
      if (parsed.meta["batch_id"] && /^[0-9a-f-]{36}$/i.test(parsed.meta["batch_id"])) {
        const match = await supabase.from("uploads").select("detected_rows").eq("id", parsed.meta["batch_id"]).maybeSingle();
        if (match.error) throw new Error("Could not compare with the detected upload");
        if (match.data?.detected_rows) setComparison(compareDetected(parsed.rows, match.data.detected_rows));
      }
    });
  }
  async function makeReview(nextRows = rows) {
    await act(async () => {
      if (!file) throw new Error("Choose an input template");
      let id = uploadId;
      if (!id) {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user) throw new Error("Sign in again");
        id = crypto.randomUUID();
        const path = `${auth.data.user.id}/${id}/${file.name.replace(/[\\/]/g, "_")}`;
        const original = await supabase.storage.from("pricelists").upload(path, file);
        if (original.error) throw new Error("Could not save original file");
        const saved = await supabase.from("uploads").insert({ id, tool: "build", brand_activity: brand, vendor_currency: currency, file_name: file.name, file_path: path, counts: { input: rows.length } });
        if (saved.error) { await supabase.storage.from("pricelists").remove([path]); throw new Error("Could not save upload"); }
        setUploadId(id);
      }
      const result = await build({ data: { brand_activity: brand, vendor_currency: currency, entity_codes: selected, rows: nextRows } });
      setReviews(result); setRows(nextRows); setDownloads({});
      const failing = result.flatMap(e => e.rows.filter(r => r.checks.some(c => c.level === "error")));
      const indices = [...new Set(failing.map(r => r.inputIndex))];
      setProblems(indices.length ? await rowsBlob([...INPUT_HEADERS, "Problem"], indices.map(i => ({ ...nextRows[i], Problem: [...new Set(failing.filter(r => r.inputIndex === i).flatMap(r => r.checks.map(c => c.message)))].join("; ") }))) : null);
    });
  }
  async function prepareExport(entity: string) {
    await act(async () => {
      if (!uploadId) throw new Error("Build an upload first");
      const result = await save({ data: { upload_id: uploadId, entity_code: entity, rows } });
      const blob = await erpBlob(result.rows);
      setDownloads(d => ({ ...d, [entity]: blob }));
    });
  }
  return <div className="space-y-6 min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="nmk-page-heading">Build ERP Upload</h1><p className="mt-1 text-sm text-muted-foreground">Pick entities, check the rows, and download one ERP file per entity.</p></div></div>
    <Stepper steps={["Upload", "Entities", "Review", "Download"]} current={reviews.length ? Object.keys(downloads).length === reviews.length ? 3 : 2 : file ? 1 : 0} onBack={() => { setReviews([]); setDownloads({}); }} />
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-full space-y-2 sm:w-60"><Label className="text-[11px] uppercase text-muted-foreground">Brand Activity</Label><Select value={brand} disabled={Boolean(file) || busy} onValueChange={b => { setBrand(b); setCurrency(""); setSelected([]); setTemplate(null); }}><SelectTrigger className="bg-card"><SelectValue placeholder="Choose brand" /></SelectTrigger><SelectContent>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
      <div className="w-full space-y-2 sm:w-48"><Label className="text-[11px] uppercase text-muted-foreground">Vendor Currency</Label><Select value={currency} disabled={busy || Boolean(reviews.length)} onValueChange={c => { setCurrency(c); setSelected([]); setTemplate(null); resetReview(); }}><SelectTrigger className="bg-card"><SelectValue placeholder="Choose currency" /></SelectTrigger><SelectContent>{[...new Set([...currencies, ...(currency ? [currency] : [])])].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="outline" disabled={!template || busy} onClick={() => { if (template) downloadBlob(template, `${brand}_blank_template.xlsx`); }}><Download />Download blank template</Button>
    </div>
    <UploadArea id="build-file" onFile={f => void upload(f)} file={file} disabled={busy} details={`${rows.length} rows · Brand ${brand} · Currency ${currency}`} onRemove={() => { setFile(null); setRows([]); setComparison(""); resetReview(); }} />
    {comparison && <p className="text-sm text-muted-foreground">{comparison}</p>}
    <div className="space-y-5">{regions.map(region => {
      const entities = options.entities.filter(e => e.region === region), allowed = entities.filter(e => available.has(e.code));
      return <section key={region} className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="text-[11px] font-semibold uppercase text-muted-foreground">{region}</h2><Label className="flex items-center gap-2 text-xs"><Checkbox disabled={busy || Boolean(reviews.length) || !allowed.length} checked={Boolean(allowed.length) && allowed.every(e => selected.includes(e.code))} onCheckedChange={v => setSelected(s => v ? [...new Set([...s, ...allowed.map(e => e.code)])] : s.filter(c => !allowed.some(e => e.code === c)))} />Select all</Label></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{entities.map(e => <EntityCard key={e.code} code={e.code} name={e.name} currency={e.currency} disabled={busy || Boolean(reviews.length) || !available.has(e.code)} checked={selected.includes(e.code)} reason={available.has(e.code) ? undefined : "no pricing rule"} onChange={v => setSelected(s => v ? [...s, e.code] : s.filter(c => c !== e.code))} />)}</div></section>;
    })}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!reviews.length ? <Button disabled={busy || !file || !currency || !brand || !selected.length} onClick={() => makeReview()}><Upload />{busy ? "Working..." : "Build ERP rows"}</Button> : <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => { setReviews([]); setDownloads({}); }}>Back to upload</Button>{problems && <Button variant="outline" onClick={() => downloadBlob(problems, "input_rows_with_problems.xlsx")}><Download />Download rows with problems</Button>}{errorIndices.size > 0 && <Button disabled={busy || errorIndices.size === rows.length} onClick={() => makeReview(rows.filter((_, i) => !errorIndices.has(i)))}>Exclude {errorIndices.size} error rows and continue</Button>}</div>
      <Tabs defaultValue={reviews[0]?.entity_code ?? ""}>
        <TabsList className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0">{reviews.map(e => <TabsTrigger className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none" key={e.entity_code} value={e.entity_code}>{e.entity_code}<span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{e.rows.length}</span>{e.rows.some(r => r.checks.length) && <span className={e.rows.some(r => r.checks.some(c => c.level === "error")) ? "size-1.5 rounded-full bg-destructive" : "size-1.5 rounded-full bg-warning"} />}</TabsTrigger>)}</TabsList>
        {reviews.map(e => {
          const errors = e.rows.filter(r => r.checks.some(c => c.level === "error")).length, warnings = e.rows.filter(r => !r.checks.some(c => c.level === "error") && r.checks.length).length;
          return <TabsContent key={e.entity_code} value={e.entity_code} className="min-w-0 space-y-4 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{e.rows.length - errors - warnings} OK · {warnings} warning · {errors} error</p><span title={errorIndices.size ? "Resolve or exclude error rows before downloading" : undefined}>{downloads[e.entity_code] ? <Button onClick={() => { const blob = downloads[e.entity_code]; if (blob) downloadBlob(blob, exportFilename(e.entity_code, brand)); }}><Download />Download {e.entity_code} Excel</Button> : <Button disabled={busy || errorIndices.size > 0} onClick={() => prepareExport(e.entity_code)}><Download />{busy ? "Preparing..." : `Prepare ${e.entity_code} Excel`}</Button>}</span></div><BuildReview review={e} vendorCurrency={currency} entityCurrency={options.entities.find(x => x.code === e.entity_code)?.currency ?? ""} /></TabsContent>;
        })}
      </Tabs>
    </div>}
  </div>;
}