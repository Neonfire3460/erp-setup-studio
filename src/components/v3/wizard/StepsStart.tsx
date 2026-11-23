// Step 1 (brand, entities, cost currency, option) and Step 2 (Option B template; Option A comes next).
import { useMemo, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { EntityCard } from "@/components/EntityCard";
import { UploadArea } from "@/components/UploadArea";
import { Card, Label11, errText, fmtNum } from "@/components/v3/ui";
import { cn } from "@/lib/utils";
import { downloadBlob, XLSX_TYPE } from "@/lib/v3/page";
import { templatePrefill } from "@/lib/v3/wizard.functions";
import {
  buildTemplate,
  readTemplate,
  templateFileName,
  type ReadTemplateResult,
  type TemplateSpec,
} from "@/lib/nmk/template";
import type { TicketDraft } from "@/lib/nmk/types";
import {
  brandOf,
  loadExcelJS,
  regionLabel,
  regionOf,
  toTicketLine,
  type StepProps,
} from "./shared";

export function StepBrand({ draft, setDraft, opts, next, busy }: StepProps) {
  const [open, setOpen] = useState(false);
  const brand = brandOf(opts, draft.brand);
  const brandEntities = brand?.entity_codes.length
    ? brand.entity_codes
    : opts.entities.map((e) => e.code);
  const picked = new Set(draft.entities.map((e) => e.code));
  const currencies = opts.currencies.map((c) => c.code);

  function pickBrand(name: string) {
    const b = brandOf(opts, name);
    setDraft((d) => {
      if (
        d.brand &&
        d.lines.length &&
        d.brand !== name &&
        !window.confirm("Changing the brand clears the items you loaded. Continue?")
      )
        return d;
      return {
        ...d,
        brand: name,
        entities: [],
        lines: d.brand === name ? d.lines : [],
        suppliers: [],
        stdCurrency: b?.last_currency || d.stdCurrency || "USD",
      };
    });
    setOpen(false);
  }
  function toggle(code: string, on: boolean) {
    const e = opts.entities.find((x) => x.code === code)!;
    setDraft((d) => {
      const entities = on
        ? [...d.entities, { code, costCurrency: d.stdCurrency, ownCost: false }]
        : d.entities.filter((x) => x.code !== code);
      entities.sort(
        (a, b) =>
          opts.entities.findIndex((x) => x.code === a.code) -
          opts.entities.findIndex((x) => x.code === b.code),
      );
      return {
        ...d,
        entities,
        region: entities.length
          ? regionOf(opts.entities.find((x) => x.code === entities[0]!.code)!.region)
          : regionOf(e.region),
        suppliers: [],
      };
    });
  }
  const setStd = (c: string) =>
    setDraft((d) => ({
      ...d,
      stdCurrency: c,
      entities: d.entities.map((e) => (e.ownCost ? e : { ...e, costCurrency: c })),
    }));
  const setOwn = (code: string, ownCost: boolean, currency?: string) =>
    setDraft((d) => ({
      ...d,
      entities: d.entities.map((e) =>
        e.code === code
          ? { ...e, ownCost, costCurrency: ownCost ? (currency ?? e.costCurrency) : d.stdCurrency }
          : e,
      ),
    }));

  const regions = (["ME", "SEA"] as const)
    .map((r) => ({
      r,
      list: opts.entities.filter((e) => regionOf(e.region) === r && brandEntities.includes(e.code)),
    }))
    .filter((g) => g.list.length);
  const ready = !!draft.brand && draft.entities.length > 0 && !!draft.stdCurrency;

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <Label11>Brand</Label11>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full max-w-md justify-between rounded-lg"
            >
              {draft.brand || "Pick a brand"}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search brands" />
              <CommandList>
                <CommandEmpty>No brand found. An admin adds brands in Admin settings.</CommandEmpty>
                <CommandGroup>
                  {opts.brands.map((b) => (
                    <CommandItem
                      key={b.brand_activity}
                      value={b.brand_activity}
                      onSelect={() => pickBrand(b.brand_activity)}
                    >
                      <Check
                        className={cn(
                          "mr-2",
                          draft.brand === b.brand_activity ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {b.brand_activity}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {brand && !brand.entity_codes.length && (
          <p className="text-xs text-warning">
            An admin hasn't set this brand's entities yet, so all entities show.
          </p>
        )}
      </Card>

      {draft.brand && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label11>Entities</Label11>
              <p className="mt-1 text-sm text-muted-foreground">
                Tick where this brand is sold. One region per ticket.
              </p>
            </div>
            <div className="w-48">
              <Label11>Vendor cost currency</Label11>
              <Select value={draft.stdCurrency} onValueChange={setStd}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {regions.map(({ r, list }) => (
            <div key={r} className="space-y-2">
              <Label11>{regionLabel(r)}</Label11>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((e) => {
                  const other = draft.entities.length > 0 && regionOf(e.region) !== draft.region;
                  return (
                    <EntityCard
                      key={e.code}
                      code={e.code}
                      name={e.name}
                      currency={`Sells in ${e.currency}`}
                      checked={picked.has(e.code)}
                      disabled={other}
                      reason={other ? "Another region is ticked" : undefined}
                      onChange={(v) => toggle(e.code, v)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          {draft.entities.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm">
                One standard cost in <b>{draft.stdCurrency}</b> for every ticked entity. Only retail
                differs. If one entity has a different cost, tick it here.
              </p>
              {draft.entities.map((e) => (
                <div key={e.code} className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={e.ownCost}
                      onCheckedChange={(v) => setOwn(e.code, v === true, e.costCurrency)}
                    />
                    Different cost for {e.code}
                  </label>
                  {e.ownCost && (
                    <Select value={e.costCurrency} onValueChange={(c) => setOwn(e.code, true, c)}>
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {ready && (
        <Card className="space-y-3">
          <Label11>How do you want to add prices?</Label11>
          <div className="grid gap-3 md:grid-cols-2">
            <OptionCard
              active={draft.source === "ai"}
              icon={Sparkles}
              title="Option A · Vendor pricelist (AI)"
              text="Upload the vendor's PDF or Excel pricelist and the AI reads codes, descriptions and costs. Coming in the next update."
              disabled
              onClick={() =>
                toast("Option A is coming in the next update", {
                  description: "Use the template for now.",
                })
              }
            />
            <OptionCard
              active={draft.source === "template"}
              icon={FileSpreadsheet}
              title="Option B · Template"
              text="Download a one-sheet Excel template, fill in the costs and upload it."
              onClick={() => setDraft((d) => ({ ...d, source: "template" }))}
            />
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button disabled={!ready || busy} onClick={() => next()}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function OptionCard({
  active,
  icon: Icon,
  title,
  text,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: typeof Sparkles;
  title: string;
  text: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex gap-3 rounded-lg border-2 p-4 text-left",
        active && !disabled ? "border-primary bg-accent" : "border-border bg-card",
        disabled && "opacity-60",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

export function StepPrices({ draft, setDraft, next, back, busy }: StepProps) {
  const [prefill, setPrefill] = useState(false);
  const [working, setWorking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReadTemplateResult | null>(null);
  const spec = useMemo<TemplateSpec>(
    () => ({
      brand: draft.brand,
      stdCurrency: draft.stdCurrency,
      ownCost: draft.entities
        .filter((e) => e.ownCost)
        .map((e) => ({ entityCode: e.code, currency: e.costCurrency })),
    }),
    [draft],
  );

  async function download() {
    setWorking(true);
    try {
      const ExcelJS = await loadExcelJS();
      const items = prefill
        ? await templatePrefill({ data: { brand: draft.brand, region: draft.region } })
        : [];
      const buf = await buildTemplate(ExcelJS, { ...spec, prefill: items });
      downloadBlob(new Blob([buf], { type: XLSX_TYPE }), templateFileName(draft.brand));
      if (prefill) toast.success(`Template with ${items.length} current items downloaded`);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setWorking(false);
    }
  }

  async function read(f: File, s: TemplateSpec = spec) {
    setFile(f);
    setWorking(true);
    try {
      const ExcelJS = await loadExcelJS();
      const r = await readTemplate(ExcelJS, await f.arrayBuffer(), s);
      setResult(r);
      if (r.ok) setDraft((d) => ({ ...d, lines: r.lines.map(toTicketLine) }));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setWorking(false);
    }
  }

  /** The file says another currency: the user decides which is right. */
  async function answerCurrency(
    q: ReadTemplateResult["currencyQuestions"][number],
    useFile: boolean,
  ) {
    if (!file) return;
    const m = q.header.match(/^Cost Price (\d+) /i);
    const cur = useFile ? q.found : q.expected;
    let d: TicketDraft = draft;
    if (useFile) {
      d = m
        ? {
            ...draft,
            entities: draft.entities.map((e) =>
              e.code === m[1] ? { ...e, costCurrency: cur } : e,
            ),
          }
        : {
            ...draft,
            stdCurrency: cur,
            entities: draft.entities.map((e) => (e.ownCost ? e : { ...e, costCurrency: cur })),
          };
      setDraft(() => d);
      toast(`Cost currency set to ${cur}`);
    } else {
      toast(
        "Keep your pick: rename the column in the file to the currency you picked, then upload it again.",
      );
      return;
    }
    await read(file, {
      brand: d.brand,
      stdCurrency: d.stdCurrency,
      ownCost: d.entities
        .filter((e) => e.ownCost)
        .map((e) => ({ entityCode: e.code, currency: e.costCurrency })),
    });
  }

  if (draft.source === "ai")
    return (
      <Card>
        <p className="text-sm">
          Option A is coming in the next update.{" "}
          <Button
            variant="link"
            className="px-1"
            onClick={() => setDraft((d) => ({ ...d, source: "template" }))}
          >
            Use the template
          </Button>
        </p>
      </Card>
    );
  const errors = result?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.level === "warning") ?? [];
  const costHeads = [
    `Cost (${draft.stdCurrency})`,
    ...spec.ownCost.map((o) => `Cost ${o.entityCode} (${o.currency})`),
  ];

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <Label11>1 · Download the template</Label11>
        <p className="text-sm text-muted-foreground">
          One sheet: Item Code, Alternative Code, Description, Alternative Description,{" "}
          {costHeads.join(", ")}.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={prefill} onCheckedChange={(v) => setPrefill(v === true)} />
          Pre-fill with this brand's current ERP items (you only type the new costs and add new
          codes at the bottom)
        </label>
        <Button variant="outline" onClick={download} disabled={working}>
          <Download />
          Download template
        </Button>
      </Card>
      <Card className="space-y-3">
        <Label11>2 · Upload the filled file</Label11>
        <UploadArea
          file={file}
          onFile={(f) => void read(f)}
          disabled={working}
          details={result ? `${result.lines.length} items read` : undefined}
          onRemove={() => {
            setFile(null);
            setResult(null);
          }}
        />
        {result?.problems.map((p) => (
          <p key={p} className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
            {p}
          </p>
        ))}
        {result?.currencyQuestions.map((q) => (
          <div
            key={q.header}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft p-3 text-sm"
          >
            <AlertTriangle className="size-4 text-warning" />
            <span>
              The column says <b>{q.header}</b>, but you picked <b>{q.expected}</b>. Which currency
              is right?
            </span>
            <Button size="sm" variant="outline" onClick={() => void answerCurrency(q, true)}>
              {q.found} (the file)
            </Button>
            <Button size="sm" variant="outline" onClick={() => void answerCurrency(q, false)}>
              {q.expected} (my pick)
            </Button>
          </div>
        ))}
        {result && result.demoSkipped.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {result.demoSkipped.length} Demo code{result.demoSkipped.length === 1 ? "" : "s"} left
            out.
          </p>
        )}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="max-h-72 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Row</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...errors, ...warnings].map((i, k) => (
                  <TableRow key={k} className={i.level === "error" ? "bg-destructive-soft/50" : ""}>
                    <TableCell>{i.row}</TableCell>
                    <TableCell className="font-semibold">{i.itemCode}</TableCell>
                    <TableCell
                      className={i.level === "error" ? "text-destructive" : "text-warning"}
                    >
                      {i.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {errors.length > 0 && (
          <p className="text-sm text-destructive">
            Fix the {errors.length} error{errors.length === 1 ? "" : "s"} in Excel and upload the
            file again.
          </p>
        )}
      </Card>
      {draft.lines.length > 0 && (!result || result.ok) && (
        <Card className="space-y-3">
          <Label11>{draft.lines.length} items ready</Label11>
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  {costHeads.map((h) => (
                    <TableHead key={h} className="text-right">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lines.slice(0, 200).map((l) => (
                  <TableRow key={l.lineNo}>
                    <TableCell className="font-semibold">{l.itemCode}</TableCell>
                    <TableCell className="max-w-96 truncate">{l.description}</TableCell>
                    <TableCell className="text-right">
                      {fmtNum(l.cost)}
                      {l.priceOnRequest ? " (POA)" : ""}
                    </TableCell>
                    {spec.ownCost.map((o) => (
                      <TableCell key={o.entityCode} className="text-right">
                        {fmtNum(l.entityCosts[o.entityCode])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {draft.lines.length > 200 && (
            <p className="text-xs text-muted-foreground">Showing the first 200.</p>
          )}
        </Card>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
        <Button
          disabled={
            !draft.lines.length ||
            errors.length > 0 ||
            !!result?.problems.length ||
            !!result?.currencyQuestions.length ||
            busy ||
            working
          }
          onClick={() => next()}
        >
          Continue to Price check
        </Button>
      </div>
    </div>
  );
}
