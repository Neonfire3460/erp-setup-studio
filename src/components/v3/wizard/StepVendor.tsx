// Step 2A: Option A. Upload the vendor's pricelist (Excel or PDF). The AI says which column is which, the user
// answers its questions, then reviews every row. Codes and prices are always copied from the file.
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadArea } from "@/components/UploadArea";
import { Card, Label11, errText, fmtNum } from "@/components/v3/ui";
import {
  MAX_BYTES,
  MAX_ROWS,
  aiSample,
  applyMapping,
  guessMapping,
  headerSignature,
  pdfTable,
  sheetTable,
  type ColumnMapping,
  type VendorLine,
  type VendorTable,
} from "@/lib/nmk/vendorRead";
import type { PdfTextItem } from "@/lib/nmk/pdfOrder";
import type { TicketDraft } from "@/lib/nmk/types";
import { aiReadLayout, saveAiLayout, type AiLayout } from "@/lib/v3/ai.functions";
import { cn } from "@/lib/utils";
import { toTicketLine } from "./shared";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

async function readPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: (PdfTextItem & { w: number })[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items as { str?: string; transform?: number[]; width?: number }[])
      if (it.str && it.transform)
        out.push({
          page: p,
          x: it.transform[4]!,
          y: it.transform[5]!,
          w: it.width ?? 0,
          str: it.str,
        });
  }
  return out;
}

async function readFile(file: File): Promise<VendorTable[]> {
  if (/\.pdf$/i.test(file.name)) {
    const t = pdfTable(await readPdf(file));
    return t ? [t] : [];
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb.SheetNames.map((n) =>
    sheetTable(
      n,
      XLSX.utils.sheet_to_json(wb.Sheets[n]!, { header: 1, defval: "", raw: false }) as unknown[][],
    ),
  ).filter((t): t is VendorTable => !!t && t.rows.length > 0);
}

export function StepVendor({
  draft,
  setDraft,
  next,
  back,
  busy,
}: {
  draft: TicketDraft;
  setDraft: (f: (d: TicketDraft) => TicketDraft) => void;
  next: (updated?: TicketDraft) => Promise<void>;
  back: () => void;
  busy: boolean;
}) {
  const own = draft.entities.filter((e) => e.ownCost);
  const [file, setFile] = useState<File | null>(null);
  const [tables, setTables] = useState<VendorTable[]>([]);
  const [ti, setTi] = useState(0);
  const [map, setMap] = useState<ColumnMapping | null>(null);
  const [ai, setAi] = useState<{
    layout: AiLayout | null;
    fromProfile: boolean;
    warning: string | null;
  } | null>(null);
  const [answered, setAnswered] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [working, setWorking] = useState("");
  const t = tables[ti] ?? null;

  async function ask(table: VendorTable) {
    setWorking("The AI is reading the layout...");
    try {
      const r = await aiReadLayout({
        data: { brand: draft.brand, signature: headerSignature(table), table: aiSample(table) },
      });
      setAi(r);
      const g = guessMapping(table);
      const l = r.layout;
      setMap(
        l
          ? {
              table: table.name,
              code: l.code,
              description: l.description,
              altCode: l.altCode,
              altDescription: l.altDescription,
              cost: l.cost,
              entityCost: l.entityCost ?? {},
              discountPct: l.discountPct ?? 0,
              priceColumns: l.priceColumns.map((p) => p.index),
            }
          : g,
      );
      setAnswered(r.fromProfile || (!!l && l.priceColumns.length <= 1 && l.cost !== null));
      if (r.warning) toast.warning(r.warning);
    } catch (e) {
      toast.error(errText(e));
      setMap(guessMapping(table));
    } finally {
      setWorking("");
    }
  }

  async function pick(f: File) {
    if (f.size > MAX_BYTES) {
      toast.error("The file is over 20 MB. Split it or send only this brand's pages.");
      return;
    }
    setFile(f);
    setTables([]);
    setMap(null);
    setAi(null);
    setEdits({});
    setRemoved(new Set());
    setWorking("Reading the file...");
    try {
      const list = await readFile(f);
      if (!list.length) {
        toast.error(
          "No price table found in this file. Check it has a header row with an item code and a price.",
        );
        setWorking("");
        return;
      }
      const best = list.reduce((a, b, i) => (b.rows.length > list[a]!.rows.length ? i : a), 0);
      setTables(list);
      setTi(best);
      await ask(list[best]!);
    } catch (e) {
      toast.error(errText(e));
      setWorking("");
    }
  }

  const result = useMemo(
    () => (t && map ? applyMapping(t, map, { ownCost: own.map((e) => e.code) }) : null),
    [t, map, own],
  );
  const lines: VendorLine[] = useMemo(() => {
    if (!result) return [];
    return result.lines
      .filter((l) => !removed.has(l.lineNo))
      .map((l) => {
        if (!(l.lineNo in edits)) return l;
        const n = Number(edits[l.lineNo]);
        const ok = edits[l.lineNo] !== "" && Number.isFinite(n) && n >= 0;
        return {
          ...l,
          cost: ok ? n : null,
          flags: ok ? l.flags.filter((f) => !/price/i.test(f) || /Hidden/.test(f)) : l.flags,
        };
      });
  }, [result, edits, removed]);
  const sorted = [...lines].sort(
    (a, b) => Number(b.flags.length > 0) - Number(a.flags.length > 0) || a.lineNo - b.lineNo,
  );
  const blocking = lines.filter((l) => l.cost === null).length;
  const header = (j: number | null) => (j === null || !t ? "" : (t.headers[j] ?? ""));
  const samples = (j: number) =>
    (t?.rows ?? []).slice(0, 3).map((r) => `${r.cells[map?.code ?? 0]}: ${r.cells[j]}`);
  const priceCols = map?.priceColumns.length
    ? map.priceColumns
    : t
      ? t.headers.map((_, j) => j)
      : [];

  async function done() {
    if (!t || !map) return;
    const updated: TicketDraft = {
      ...draft,
      source: "ai",
      lines: lines.map(({ flags: _f, ...l }, i) => toTicketLine({ ...l, lineNo: i + 1 })),
    };
    try {
      const layout: AiLayout = {
        ...(ai?.layout ?? {
          priceColumns: map.priceColumns.map((i) => ({
            index: i,
            label: header(i),
            kind: "other",
            currency: null,
          })),
          currencyFound: null,
          notes: [],
        }),
        code: map.code,
        description: map.description,
        altCode: map.altCode,
        altDescription: map.altDescription,
        cost: map.cost,
        entityCost: map.entityCost,
        discountPct: map.discountPct,
      };
      await saveAiLayout({
        data: {
          brand: draft.brand,
          signature: headerSignature(t),
          layout: layout as unknown as Record<string, unknown>,
        },
      });
    } catch {
      /* learning is a bonus: never block the ticket */
    }
    void next(updated);
  }

  const set = (patch: Partial<ColumnMapping>) => setMap((m) => (m ? { ...m, ...patch } : m));
  const colSelect = (
    value: number | null,
    onChange: (v: number | null) => void,
    allowNone = true,
  ) => (
    <select
      className={sel}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      {allowNone && <option value="">(none)</option>}
      {t?.headers.map((h, j) => (
        <option key={j} value={j}>
          {h}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <Label11>Upload the vendor's pricelist</Label11>
        <p className="text-sm text-muted-foreground">
          Excel or PDF, up to 20 MB and {MAX_ROWS.toLocaleString()} rows. The AI only works out
          which column is which. Every code, description and price is copied from your file, and
          each row shows where it came from.
        </p>
        <UploadArea
          file={file}
          onFile={(f) => void pick(f)}
          disabled={!!working}
          accept=".xlsx,.xls,.csv,.pdf"
          hint="Vendor pricelist: .xlsx, .xls, .csv or .pdf"
          label="Drop the pricelist here or browse"
          onRemove={() => {
            setFile(null);
            setTables([]);
            setMap(null);
            setAi(null);
          }}
        />
        {working && (
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {working}
          </p>
        )}
        {tables.length > 1 && (
          <div className="max-w-sm">
            <Label11>Sheet</Label11>
            <select
              className={cn(sel, "mt-1")}
              value={ti}
              onChange={(e) => {
                const i = Number(e.target.value);
                setTi(i);
                void ask(tables[i]!);
              }}
            >
              {tables.map((x, i) => (
                <option key={i} value={i}>
                  {x.name} ({x.rows.length} rows)
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {t && map && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <Label11>
              {ai?.fromProfile
                ? "Using the layout saved for this vendor"
                : ai?.layout
                  ? "What the AI found"
                  : "Pick the columns"}
            </Label11>
          </div>
          {ai?.layout?.notes.length ? (
            <p className="text-sm text-muted-foreground">{ai.layout.notes.join(" · ")}</p>
          ) : null}
          {!answered && priceCols.length > 1 && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-accent/50 p-3">
              <p className="text-sm font-semibold">
                This pricelist has {priceCols.length} price columns. Which one is your cost?
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {priceCols.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => {
                      set({ cost: j });
                      setAnswered(true);
                    }}
                    className={cn(
                      "rounded-lg border bg-card p-3 text-left text-sm hover:border-primary",
                      map.cost === j && "border-primary",
                    )}
                  >
                    <p className="font-semibold">{header(j)}</p>
                    {samples(j).map((s, i) => (
                      <p key={i} className="truncate text-xs text-muted-foreground">
                        {s}
                      </p>
                    ))}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label11>Item Code</Label11>
              <div className="mt-1">{colSelect(map.code, (v) => set({ code: v ?? 0 }), false)}</div>
            </div>
            <div>
              <Label11>Description</Label11>
              <div className="mt-1">
                {colSelect(map.description, (v) => set({ description: v }))}
              </div>
            </div>
            <div>
              <Label11>Alternative Code</Label11>
              <div className="mt-1">{colSelect(map.altCode, (v) => set({ altCode: v }))}</div>
            </div>
            <div>
              <Label11>Alternative Description</Label11>
              <div className="mt-1">
                {colSelect(map.altDescription, (v) => set({ altDescription: v }))}
              </div>
            </div>
            <div>
              <Label11>Cost ({draft.stdCurrency})</Label11>
              <div className="mt-1">{colSelect(map.cost, (v) => set({ cost: v }))}</div>
            </div>
            {own.map((e) => (
              <div key={e.code}>
                <Label11>
                  Cost for {e.code} ({e.costCurrency})
                </Label11>
                <div className="mt-1">
                  {colSelect(map.entityCost[e.code] ?? null, (v) =>
                    set({ entityCost: { ...map.entityCost, [e.code]: v } }),
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label11>Your discount off this price, %</Label11>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={map.discountPct || ""}
                placeholder="0 = this is my cost"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set({ discountPct: Number.isFinite(n) && n >= 0 && n < 100 ? n : 0 });
                }}
              />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              Example: Lightware gives 40% off MSRP, so pick the MSRP column and type 40.
            </p>
          </div>
          {ai?.layout?.currencyFound && ai.layout.currencyFound !== draft.stdCurrency && (
            <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
              The prices look like {ai.layout.currencyFound}, but you picked {draft.stdCurrency} in
              Step 1. Go back and change the currency if {ai.layout.currencyFound} is right.
            </p>
          )}
        </Card>
      )}

      {result && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label11>
              Review: {lines.length} items
              {result.demoSkipped.length
                ? ` (${result.demoSkipped.length} Demo codes skipped)`
                : ""}
            </Label11>
            {lines.some((l) => l.flags.length) && (
              <p className="flex items-center gap-1 text-sm text-warning">
                <AlertTriangle className="size-4" />
                {lines.filter((l) => l.flags.length).length} rows to check are on top
              </p>
            )}
          </div>
          {result.tooMany && (
            <p className="text-sm text-destructive">
              This file has over {MAX_ROWS.toLocaleString()} items. Split it into smaller files.
            </p>
          )}
          <div className="max-h-[520px] overflow-auto rounded-lg border">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-muted text-left text-[11px] font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Item Code</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Cost {draft.stdCurrency}</th>
                  {own.map((e) => (
                    <th key={e.code} className="p-2 text-right">
                      {e.code}
                    </th>
                  ))}
                  <th className="p-2">From</th>
                  <th className="p-2">Check</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 1000).map((l) => (
                  <tr
                    key={l.lineNo}
                    className={cn("border-t", l.flags.length > 0 && "bg-warning-soft/60")}
                  >
                    <td className="whitespace-nowrap p-2 font-semibold">{l.itemCode}</td>
                    <td className="max-w-72 truncate p-2" title={l.description}>
                      {l.description}
                    </td>
                    <td className="p-2 text-right">
                      {l.cost === null || l.flags.length ? (
                        <Input
                          className="ml-auto h-7 w-24 text-right"
                          inputMode="decimal"
                          value={edits[l.lineNo] ?? (l.cost ?? "").toString()}
                          onChange={(e) => setEdits((x) => ({ ...x, [l.lineNo]: e.target.value }))}
                        />
                      ) : (
                        <span className="tabular-nums">{fmtNum(l.cost)}</span>
                      )}
                    </td>
                    {own.map((e) => (
                      <td key={e.code} className="p-2 text-right tabular-nums">
                        {fmtNum(l.entityCosts[e.code])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">
                      {l.source?.page
                        ? `page ${l.source.page}, `
                        : l.source?.sheet
                          ? `${l.source.sheet}, `
                          : ""}
                      row {l.source?.row}
                    </td>
                    <td className="p-2 text-xs text-warning">{l.flags.join(" · ")}</td>
                    <td className="p-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Remove this row"
                        onClick={() => setRemoved((s) => new Set(s).add(l.lineNo))}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {blocking > 0 && (
            <p className="text-sm text-destructive">
              {blocking} row{blocking === 1 ? " has" : "s have"} no cost. Type it in or remove the
              row. For price on request, type 0.
            </p>
          )}
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
        <Button
          disabled={
            !lines.length ||
            blocking > 0 ||
            !!result?.tooMany ||
            (!answered && priceCols.length > 1) ||
            busy ||
            !!working
          }
          onClick={() => void done()}
        >
          Continue to Price check
        </Button>
      </div>
    </div>
  );
}
