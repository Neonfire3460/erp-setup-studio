import { useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { buildOptionsQuery } from "@/lib/workflow.queries";
import { submitBuild } from "@/lib/submissions.functions";
import {
  buildTemplateWorkbook,
  readTemplateWorkbook,
  checkTemplateRows,
  TEMPLATE_HEADERS,
  type TemplateSheet,
  type TemplateRow,
} from "@/lib/excelFiles";
import { downloadBlob, type Check } from "@/lib/workflow";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntityCard } from "./EntityCard";
import { UploadArea } from "./UploadArea";
import { BrandPicker } from "./BrandPicker";
import { CheckTable } from "./CheckTable";
type Sheet = TemplateSheet & { checks: Map<number, Check[]> };
export type BuildPreset = {
  brand: string;
  entities: { entity_code: string; cost_currency: string }[];
};
export function BuildSubmission({ preset }: { preset?: BuildPreset | undefined }) {
  const { data: opts } = useSuspenseQuery(buildOptionsQuery);
  const { user } = useRouteContext({ from: "/_authenticated" });
  const [brand, setBrand] = useState(preset?.brand ?? "");
  const [currency, setCurrency] = useState("USD");
  const [choices, setChoices] = useState<Record<string, string>>(
    Object.fromEntries(preset?.entities.map((e) => [e.entity_code, e.cost_currency]) ?? []),
  );
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [problemBlob, setProblemBlob] = useState<Blob | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const submit = useServerFn(submitBuild);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const b = opts.brands.find((b) => b.brand_activity === brand);
  const name = `${brand.replace(/[\\/:*?"<>|]/g, "_")}_template_${new Date().toISOString().slice(0, 10)}.xlsx`;
  function reset() {
    setFile(null);
    setSheets([]);
    setProblems([]);
    setBlob(null);
    setProblemBlob(null);
    setSavedId(null);
  }
  async function prepareTemplate() {
    if (!b || !Object.keys(choices).length) return;
    setBusy(true);
    try {
      const ExcelJS = await import("exceljs");
      const wb = buildTemplateWorkbook(ExcelJS, {
        brandActivity: brand,
        subActivities: b.sub_activities,
        sheets: opts.entities
          .filter((e) => choices[e.code])
          .map((e) => ({
            entityCode: e.code,
            entityName: e.name,
            costCurrency: choices[e.code] ?? currency,
          })),
      });
      setBlob(
        new Blob([await wb.xlsx.writeBuffer()], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare template");
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    reset();
    setFile(f);
    setBusy(true);
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const read = readTemplateWorkbook(wb, {
        entities: opts.entities,
        currencies: opts.currencies,
        defaultCurrency: currency,
      });
      if (read.brandActivity && read.brandActivity !== brand)
        read.problems.push(`The file brand is ${read.brandActivity}, not ${brand}.`);
      if (read.problems.length) {
        setProblems(read.problems);
        return;
      }
      if (!b) throw new Error("Choose a brand");
      const checked = read.sheets.map((s) => {
        const result = checkTemplateRows(s.rows, {
          brandActivity: brand,
          subActivities: b.sub_activities,
        });
        return { ...s, rows: result.rows, checks: result.checks };
      });
      setSheets(checked);
      setChoices(Object.fromEntries(checked.map((s) => [s.entityCode, s.costCurrency])));
      const problemWb = new ExcelJS.Workbook();
      let count = 0;
      for (const s of checked) {
        const bad = s.rows.filter((r) => (s.checks.get(r.row) ?? []).length);
        if (!bad.length) continue;
        count += bad.length;
        const ws = problemWb.addWorksheet(s.sheetName.slice(0, 31));
        ws.addRow([...TEMPLATE_HEADERS, "Problem"]);
        bad.forEach((r) => {
          ws.addRow([
            r.itemCode,
            r.alternativeCode,
            r.description,
            r.alternateDescription,
            r.brandActivity,
            r.subActivity,
            r.costPrice,
            r.measurementUnit,
            (s.checks.get(r.row) ?? []).map((c) => c.message).join("; "),
          ]);
        });
        ws.getColumn(1).numFmt = "@";
      }
      if (count) setProblemBlob(new Blob([await problemWb.xlsx.writeBuffer()]));
    } catch (e) {
      setProblems([e instanceof Error ? e.message : "Could not read file"]);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!file || !sheets.length || savedId) return;
    setBusy(true);
    let path: string | null = null;
    try {
      path = `${user.id}/${crypto.randomUUID()}/${file.name.replace(/[\\/]/g, "_")}`;
      const up = await supabase.storage.from("pricelists").upload(path, file);
      if (up.error) throw up.error;
      const result = await submit({
        data: {
          brand,
          path,
          sheets: sheets.map((s) => ({
            entityCode: s.entityCode,
            costCurrency: s.costCurrency,
            rows: s.rows as (TemplateRow & { costPrice: number })[],
          })),
        },
      });
      setSavedId(result.id);
      await qc.invalidateQueries({ queryKey: ["submissions"] });
      await qc.invalidateQueries({ queryKey: ["workflow-badges"] });
      toast.success("Submitted. An admin will review it before it goes to the ERP.");
    } catch (e) {
      if (path) await supabase.storage.from("pricelists").remove([path]);
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }
  const errors = sheets.some((s) => [...s.checks.values()].flat().some((c) => c.level === "error"));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="nmk-page-heading">Build ERP Upload</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Brand</Label>
          <BrandPicker
            brands={opts.brands.map((b) => b.brand_activity)}
            value={brand}
            disabled={busy}
            onChange={(v) => {
              reset();
              setBrand(v);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Vendor currency</Label>
          <Select
            value={currency}
            disabled={busy}
            onValueChange={(v) => {
              reset();
              setCurrency(v);
              setChoices(Object.fromEntries(Object.keys(choices).map((c) => [c, v])));
            }}
          >
            <SelectTrigger className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.currencies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {["Middle East", "South East Asia"].map((region) => (
        <section key={region} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">{region}</h2>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                reset();
                const regionEntities = opts.entities.filter((e) => e.region === region);
                const all = regionEntities.every((e) => choices[e.code]);
                setChoices((prev) => {
                  const n = { ...prev };
                  regionEntities.forEach((e) => {
                    if (all) delete n[e.code];
                    else n[e.code] = currency;
                  });
                  return n;
                });
              }}
            >
              {opts.entities.filter((e) => e.region === region).every((e) => choices[e.code])
                ? "Deselect all"
                : "Select all"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {opts.entities
              .filter((e) => e.region === region)
              .map((e) => (
                <div key={e.code} className="space-y-2">
                  <EntityCard
                    code={e.code}
                    name={e.name}
                    currency={e.currency}
                    checked={Boolean(choices[e.code])}
                    disabled={busy}
                    onChange={(on) => {
                      reset();
                      setChoices((prev) => {
                        const n = { ...prev };
                        if (on) n[e.code] = currency;
                        else delete n[e.code];
                        return n;
                      });
                    }}
                  />
                  {choices[e.code] && (
                    <div className="space-y-1">
                      <Label>Cost currency · {e.code}</Label>
                      <Select
                        value={choices[e.code] ?? currency}
                        disabled={busy}
                        onValueChange={(v) => {
                          reset();
                          setChoices((prev) => ({ ...prev, [e.code]: v }));
                        }}
                      >
                        <SelectTrigger className="bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {opts.currencies.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap gap-3">
        {blob ? (
          <Button variant="outline" onClick={() => downloadBlob(blob, name)}>
            <Download />
            Download template
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={!brand || !Object.keys(choices).length || busy}
            onClick={() => void prepareTemplate()}
          >
            Prepare blank template
          </Button>
        )}
      </div>
      <UploadArea
        file={file}
        disabled={!brand || busy}
        onFile={(f) => void upload(f)}
        onRemove={reset}
        details={sheets.length ? `${sheets.length} sheets` : ""}
      />
      {problems.length > 0 && (
        <ul className="space-y-1 text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {sheets.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {problemBlob && (
              <Button
                variant="outline"
                onClick={() => downloadBlob(problemBlob, `Problems_${name}`)}
              >
                <Download />
                Download rows with problems
              </Button>
            )}
            <Button
              disabled={busy || errors || Boolean(savedId)}
              title={errors ? "Correct all errors before submitting" : undefined}
              onClick={() => void send()}
            >
              <Send />
              {busy ? "Saving…" : savedId ? "Submitted" : "Submit"}
            </Button>
          </div>
          <Tabs defaultValue={sheets[0]?.entityCode ?? ""}>
            {
              <TabsList>
                {sheets.map((s) => (
                  <TabsTrigger key={s.entityCode} value={s.entityCode}>
                    {s.entityCode} · {s.rows.length} rows · {s.costCurrency}
                  </TabsTrigger>
                ))}
              </TabsList>
            }
            {sheets.map((s) => (
              <TabsContent key={s.entityCode} value={s.entityCode}>
                <CheckTable
                  columns={[
                    ...TEMPLATE_HEADERS.slice(0, 6),
                    `Cost ${s.costCurrency}`,
                    "Measurement Unit",
                  ]}
                  rows={s.rows.map((r) => ({
                    key: String(r.row),
                    values: {
                      "Item Code": r.itemCode,
                      "Alternative Code": r.alternativeCode,
                      Description: r.description,
                      "Alternate Description": r.alternateDescription,
                      "Brand Activity": r.brandActivity,
                      "Sub Activity": r.subActivity,
                      [`Cost ${s.costCurrency}`]: r.costPrice,
                      "Measurement Unit": r.measurementUnit,
                    },
                    checks: s.checks.get(r.row) ?? [],
                  }))}
                />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
      {savedId && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-success">
            Submitted. An admin will review it before it goes to the ERP.
          </p>
          <Button variant="outline" onClick={() => void navigate({ to: "/my-submissions" })}>
            My submissions
          </Button>
        </div>
      )}
    </div>
  );
}
