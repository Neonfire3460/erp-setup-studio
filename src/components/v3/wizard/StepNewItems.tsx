// Step 4: register new items. Family > Group > Category in words (codes kept), Midwich shown greyed,
// unit, sub activity, ERP status, Website and B2B prices. Three ways to fill fast: the AI's recommended
// details, "Fill many at once" for ticked rows, and "Copy this row" to other rows. Empty fields are shown
// at the top and again on Continue, where the user can still continue (the reviewer fills the rest).
import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, Label11, errText, fmtNum } from "@/components/v3/ui";
import {
  categoryBySub,
  categoryOptions,
  familyOptions,
  groupOptions,
  suggestCategory,
  type CategoryRow,
} from "@/lib/nmk/categories";
import { checkDraft } from "@/lib/nmk/ticket";
import { aiSuggestNewItems } from "@/lib/v3/aiItems.functions";
import type { NewItemFields, TicketLine } from "@/lib/nmk/types";
import { cn } from "@/lib/utils";
import { brandOf, toCategoryRows, type PriceCheckData, type StepProps } from "./shared";

const sel = "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-[13px]";
const AI_RING = "ring-2 ring-violet-400/70 bg-violet-50 dark:bg-violet-950/30";
type Fields = Partial<NewItemFields>;
/** The fields "Copy this row" and "Fill many" carry (not codes or descriptions, which are per item). */
const COPY_KEYS = [
  "familyCode",
  "groupCode",
  "subCategoryCode",
  "unitCode",
  "subActivity",
  "inactive",
  "showOnWeb",
  "showPrices",
] as const;
const empty = (v: unknown) => v === "" || v === null || v === undefined;

/** Two-button switch: Show / Hide (null = not answered yet). */
function ShowHide({
  value,
  onChange,
  disabled,
  missing,
  ai,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  missing?: boolean;
  ai?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border text-[12px] font-semibold",
        missing && "border-destructive/60",
        ai && AI_RING,
        disabled && "opacity-40",
      )}
    >
      {[
        [true, "Show"],
        [false, "Hide"],
      ].map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v as boolean)}
          className={cn(
            "px-2.5 py-1 transition",
            value === v
              ? v
                ? "bg-success text-white"
                : "bg-muted-foreground text-white"
              : "bg-background hover:bg-muted",
          )}
        >
          {label as string}
        </button>
      ))}
    </div>
  );
}

export function StepNewItems({
  draft,
  setDraft,
  opts,
  next,
  back,
  busy,
  pc,
}: StepProps & { pc: PriceCheckData | null }) {
  const cats = useMemo(() => toCategoryRows(opts), [opts]);
  const brand = brandOf(opts, draft.brand);
  const subs = brand?.sub_activities ?? [];
  const lines = draft.lines.filter((l) => l.isNew);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<Fields>({});
  const [ai, setAi] = useState<Map<number, { fields: Set<string>; why: string }>>(new Map());
  const [aiBusy, setAiBusy] = useState(false);
  const [popup, setPopup] = useState(false);
  const known = pc?.known ?? [];
  const missing = checkDraft(draft, {
    units: opts.units.map((u) => u.code),
    ...(subs.length ? { subActivities: subs } : {}),
  }).filter((m) => m.step === 4);
  const missingRows = new Set(missing.map((m) => m.lineNo));

  const update = (
    lineNos: number[],
    f: Fields | ((n: NewItemFields, l: TicketLine) => Fields),
    include?: boolean,
  ) => {
    const set = new Set(lineNos);
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        if (!set.has(l.lineNo) || !l.isNew || !l.newItem) return l;
        const patch = typeof f === "function" ? f(l.newItem, l) : f;
        const n = { ...l.newItem, ...patch };
        if (n.showOnWeb === false) n.showPrices = false; // a hidden product never shows prices
        return { ...l, ...(include === undefined ? {} : { include }), newItem: n };
      }),
    }));
    // A value the user sets is theirs, not the AI's.
    const keys = Object.keys(typeof f === "function" ? {} : f);
    if (keys.length)
      setAi((m) => {
        const x = new Map(m);
        for (const no of lineNos) {
          const e = x.get(no);
          if (e) keys.forEach((k) => e.fields.delete(k));
        }
        return x;
      });
  };
  const setDescription = (lineNo: number, description: string) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) =>
        l.lineNo === lineNo
          ? { ...l, vendorDescription: l.vendorDescription ?? l.description, description }
          : l,
      ),
    }));

  const suggest = (l: TicketLine): Fields | null => {
    const s = suggestCategory(l.itemCode, known);
    const c = s ? categoryBySub(cats, s.subCategoryCode) : null;
    if (!c) return null;
    const sub = known.find((k) => k.itemCode === s!.likeItem)?.subActivity;
    return {
      familyCode: c.familyCode,
      groupCode: c.groupCode,
      subCategoryCode: c.subCategoryCode,
      ...(sub && subs.includes(sub) ? { subActivity: sub } : {}),
    };
  };
  const suggestAll = () => {
    let n = 0;
    for (const l of lines) {
      const s = suggest(l);
      if (s && !l.newItem?.subCategoryCode) {
        update([l.lineNo], s);
        n++;
      }
    }
    toast(
      n
        ? `Filled the category for ${n} item${n === 1 ? "" : "s"} from similar codes`
        : "No similar codes found for the empty rows",
    );
  };

  /** AI: fills only empty fields; descriptions become the AI's (the vendor's wording is kept to go back to). */
  async function runAi() {
    const todo = lines.filter((l) => l.include);
    if (!todo.length) return;
    setAiBusy(true);
    let filled = 0;
    try {
      for (let i = 0; i < todo.length; i += 40) {
        const part = todo.slice(i, i + 40);
        const r = await aiSuggestNewItems({
          data: {
            brand: draft.brand,
            region: draft.region,
            subActivities: subs,
            units: opts.units.map((u) => u.code),
            items: part.map((l) => ({
              lineNo: l.lineNo,
              itemCode: l.itemCode,
              description: l.vendorDescription ?? l.description,
              altDescription: l.altDescription,
            })),
          },
        });
        if (r.warning) {
          toast.warning(r.warning);
          if (!r.items.length) break;
        }
        const byNo = new Map(r.items.map((x) => [x.lineNo, x]));
        const marks = new Map<number, { fields: Set<string>; why: string }>();
        const patched = new Map<number, TicketLine>();
        for (const l of part) {
          const s = byNo.get(l.lineNo);
          if (!s || !l.newItem) continue;
          const n = { ...l.newItem };
          const f = new Set<string>();
          const take = <K extends keyof NewItemFields>(k: K, v: NewItemFields[K] | undefined) => {
            if (v === undefined || v === "" || !empty(n[k])) return;
            n[k] = v;
            f.add(k);
          };
          if (s.subCategoryCode && empty(n.subCategoryCode)) {
            n.familyCode = s.familyCode!;
            n.groupCode = s.groupCode!;
            n.subCategoryCode = s.subCategoryCode;
            f.add("familyCode").add("groupCode").add("subCategoryCode");
          }
          take("unitCode", s.unitCode);
          take("subActivity", s.subActivity);
          take("showOnWeb", s.showOnWeb);
          if (s.showOnWeb !== undefined && empty(n.showPrices)) {
            n.showPrices = s.showOnWeb;
            f.add("showPrices");
          }
          const vendorLong = l.altDescription || l.description;
          if (s.altDescription && (empty(n.altDescription) || n.altDescription === vendorLong)) {
            n.altDescription = s.altDescription;
            f.add("altDescription");
          }
          let out: TicketLine = { ...l, newItem: n };
          if (s.description) {
            out = {
              ...out,
              vendorDescription: l.vendorDescription ?? l.description,
              aiDescription: s.description,
              description: s.description,
            };
            f.add("description");
          }
          if (f.size) {
            filled++;
            marks.set(l.lineNo, { fields: f, why: s.why });
            patched.set(l.lineNo, out);
          }
        }
        setDraft((d) => ({ ...d, lines: d.lines.map((l) => patched.get(l.lineNo) ?? l) }));
        setAi((m) => new Map([...m, ...marks]));
      }
      if (filled)
        toast.success(
          `The AI filled ${filled} item${filled === 1 ? "" : "s"}. Its suggestions are in purple. Check them and change anything.`,
        );
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setAiBusy(false);
    }
  }

  const copyFrom = (l: TicketLine, to: "ticked" | "empty" | "all") => {
    const src = l.newItem!;
    const vals = Object.fromEntries(
      COPY_KEYS.filter((k) => !empty(src[k])).map((k) => [k, src[k]]),
    ) as Fields;
    const targets = lines.filter(
      (x) =>
        x.lineNo !== l.lineNo &&
        x.include &&
        (to === "all" || (to === "ticked" ? picked.has(x.lineNo) : true)),
    );
    if (to === "empty")
      update(
        targets.map((x) => x.lineNo),
        (n) =>
          Object.fromEntries(
            Object.entries(vals).filter(([k]) => empty(n[k as keyof NewItemFields])),
          ) as Fields,
      );
    else
      update(
        targets.map((x) => x.lineNo),
        vals,
      );
    toast.success(
      `Copied ${l.itemCode}'s details to ${targets.length} row${targets.length === 1 ? "" : "s"}`,
    );
  };

  const allPicked = lines.length > 0 && lines.every((l) => picked.has(l.lineNo));
  const bulkVals = Object.fromEntries(Object.entries(bulk).filter(([, v]) => !empty(v))) as Fields;
  const isAi = (lineNo: number, k: string) => ai.get(lineNo)?.fields.has(k) ?? false;

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Label11>Register new items ({lines.length})</Label11>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Fill every column. Untick "Register" to leave a code out. Sub Category and Midwich
              come from the Category. Website = show the product online. B2B = show its prices
              online.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void runAi()}
              disabled={aiBusy || !lines.some((l) => l.include)}
              className="h-10 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-500"
            >
              {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {aiBusy ? "The AI is filling in..." : "Fill with AI-recommended details"}
            </Button>
            {known.length > 0 && (
              <Button variant="outline" className="h-10" onClick={suggestAll}>
                <Wand2 />
                Categories from similar codes
              </Button>
            )}
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
            <AlertTriangle className="size-4" />
            <b>
              {missingRows.size} item{missingRows.size === 1 ? " has" : "s have"} empty fields (
              {missing.length})
            </b>
            <span>, shown in red below.</span>
            <Button
              size="sm"
              variant="link"
              className="h-auto p-0 text-warning underline"
              onClick={() => {
                const first = missing[0]?.lineNo;
                if (first)
                  document.getElementById(`line-${first}`)?.scrollIntoView({ block: "center" });
              }}
            >
              Go to the first one
            </Button>
          </div>
        ) : (
          lines.some((l) => l.include) && (
            <p className="rounded-lg bg-success-soft px-3 py-2 text-sm font-semibold text-success">
              Every new item is filled in.
            </p>
          )
        )}

        <div className="space-y-2 rounded-lg border border-primary/30 bg-accent/50 p-3">
          <p className="text-sm font-semibold">
            Fill many at once{" "}
            <span className="font-normal text-muted-foreground">
              {picked.size
                ? `· ${picked.size} row${picked.size === 1 ? "" : "s"} ticked`
                : "· tick rows on the left (or the top box for all), or use the copy button on a row"}
            </span>
          </p>
          <div className="grid items-center gap-2 sm:grid-cols-3 lg:grid-cols-8">
            <CategoryPicker
              cats={cats}
              value={bulk}
              onChange={(v) => setBulk((b) => ({ ...b, ...v }))}
            />
            <select
              className={sel}
              value={bulk.unitCode ?? ""}
              onChange={(e) => setBulk((b) => ({ ...b, unitCode: e.target.value }))}
            >
              <option value="">Unit</option>
              {opts.units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              className={sel}
              value={bulk.subActivity ?? ""}
              onChange={(e) => setBulk((b) => ({ ...b, subActivity: e.target.value }))}
            >
              <option value="">Sub Activity</option>
              {subs.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className={sel}
              value={bulk.inactive === undefined ? "" : String(bulk.inactive)}
              onChange={(e) =>
                setBulk((b) => {
                  const n = { ...b };
                  if (e.target.value === "") delete n.inactive;
                  else n.inactive = Number(e.target.value) as 0 | 1;
                  return n;
                })
              }
            >
              <option value="">ERP status</option>
              <option value="0">Active</option>
              <option value="1">Inactive</option>
            </select>
            <div className="flex items-center gap-1 text-[12px]">
              Web{" "}
              <ShowHide
                value={bulk.showOnWeb}
                onChange={(v) =>
                  setBulk((b) => ({ ...b, showOnWeb: v, ...(v ? {} : { showPrices: false }) }))
                }
              />
            </div>
            <div className="flex items-center gap-1 text-[12px]">
              B2B{" "}
              <ShowHide
                value={bulk.showPrices}
                disabled={bulk.showOnWeb === false}
                onChange={(v) => setBulk((b) => ({ ...b, showPrices: v }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!picked.size || !Object.keys(bulkVals).length}
              onClick={() => {
                update([...picked], bulkVals);
                setBulk({});
              }}
            >
              Apply to {picked.size || "ticked"} row{picked.size === 1 ? "" : "s"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!Object.keys(bulkVals).length}
              onClick={() => {
                update(
                  lines.filter((l) => l.include).map((l) => l.lineNo),
                  (n) =>
                    Object.fromEntries(
                      Object.entries(bulkVals).filter(([k]) => empty(n[k as keyof NewItemFields])),
                    ) as Fields,
                );
                setBulk({});
              }}
            >
              Fill only empty fields in all rows
            </Button>
            {picked.size > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
                Untick all
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-auto rounded-lg border">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
            <thead className="bg-muted text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted p-2">
                  <Checkbox
                    checked={allPicked}
                    onCheckedChange={(v) =>
                      setPicked(v === true ? new Set(lines.map((l) => l.lineNo)) : new Set())
                    }
                  />
                </th>
                {[
                  "Register",
                  "Item Code",
                  "Description",
                  "Cost",
                  "Alternative Code",
                  "Alternative Description",
                  "Family",
                  "Group",
                  "Category",
                  "Midwich",
                  "Unit",
                  "Sub Activity",
                  "ERP status",
                  "Website",
                  "B2B prices",
                  "",
                ].map((h, i) => (
                  <th key={h + i} className="whitespace-nowrap p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const n = l.newItem!;
                const cat = n.subCategoryCode ? categoryBySub(cats, n.subCategoryCode) : null;
                const miss = (v: unknown) =>
                  l.include && empty(v) ? "border-destructive/60 bg-destructive-soft/40" : "";
                const mark = (k: string) => (isAi(l.lineNo, k) ? AI_RING : "");
                const why = ai.get(l.lineNo)?.why;
                return (
                  <tr
                    key={l.lineNo}
                    id={`line-${l.lineNo}`}
                    className={cn(
                      !l.include && "opacity-50",
                      missingRows.has(l.lineNo) && "bg-warning-soft/30",
                    )}
                  >
                    <td className="sticky left-0 z-10 border-b bg-card p-2">
                      <Checkbox
                        checked={picked.has(l.lineNo)}
                        onCheckedChange={(v) =>
                          setPicked((p) => {
                            const s = new Set(p);
                            if (v === true) s.add(l.lineNo);
                            else s.delete(l.lineNo);
                            return s;
                          })
                        }
                      />
                    </td>
                    <td className="border-b p-2">
                      <Checkbox
                        checked={l.include}
                        onCheckedChange={(v) => update([l.lineNo], {}, v === true)}
                      />
                    </td>
                    <td className="whitespace-nowrap border-b p-2 font-semibold">
                      <span className="flex items-center gap-1">
                        {l.itemCode}
                        {ai.has(l.lineNo) && (
                          <Sparkles
                            className="size-3.5 text-violet-600"
                            aria-label={why ? `AI: ${why}` : "AI suggestion"}
                          />
                        )}
                      </span>
                      {why && (
                        <span
                          className="block max-w-48 truncate text-[11px] font-normal text-violet-700 dark:text-violet-300"
                          title={why}
                        >
                          {why}
                        </span>
                      )}
                    </td>
                    <td className="border-b p-2">
                      <Input
                        className={`h-8 w-72 ${miss(l.description)} ${mark("description")}`}
                        value={l.description}
                        title={
                          l.vendorDescription && l.vendorDescription !== l.description
                            ? `Vendor: ${l.vendorDescription}`
                            : undefined
                        }
                        onChange={(e) => setDescription(l.lineNo, e.target.value)}
                      />
                    </td>
                    <td className="border-b p-2 text-right tabular-nums">{fmtNum(l.cost)}</td>
                    <td className="border-b p-2">
                      <Input
                        className={`h-8 w-40 ${miss(n.altCode)}`}
                        value={n.altCode}
                        onChange={(e) => update([l.lineNo], { altCode: e.target.value })}
                      />
                    </td>
                    <td className="border-b p-2">
                      <Input
                        className={`h-8 w-64 ${miss(n.altDescription)} ${mark("altDescription")}`}
                        value={n.altDescription}
                        title={n.altDescription}
                        onChange={(e) => update([l.lineNo], { altDescription: e.target.value })}
                      />
                    </td>
                    <CategoryPicker
                      cats={cats}
                      value={n}
                      onChange={(v) => update([l.lineNo], v)}
                      cells
                      missClass={(v) => `${miss(v)} ${mark("subCategoryCode")}`}
                    />
                    <td className="whitespace-nowrap border-b p-2 text-muted-foreground">
                      {cat?.midwichName || cat?.midwichCode || ""}
                    </td>
                    <td className="border-b p-2">
                      <select
                        className={`${sel} w-28 ${miss(n.unitCode)} ${mark("unitCode")}`}
                        value={n.unitCode}
                        onChange={(e) => update([l.lineNo], { unitCode: e.target.value })}
                      >
                        <option value="" />
                        {opts.units.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b p-2">
                      <select
                        className={`${sel} w-40 ${miss(n.subActivity)} ${mark("subActivity")}`}
                        value={n.subActivity}
                        onChange={(e) => update([l.lineNo], { subActivity: e.target.value })}
                      >
                        <option value="" />
                        {subs.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b p-2">
                      <select
                        className={`${sel} w-28`}
                        value={String(n.inactive)}
                        onChange={(e) =>
                          update([l.lineNo], { inactive: Number(e.target.value) as 0 | 1 })
                        }
                      >
                        <option value="0">Active</option>
                        <option value="1">Inactive</option>
                      </select>
                    </td>
                    <td className="border-b p-2">
                      <ShowHide
                        value={n.showOnWeb}
                        missing={l.include && empty(n.showOnWeb)}
                        ai={isAi(l.lineNo, "showOnWeb")}
                        onChange={(v) => update([l.lineNo], { showOnWeb: v })}
                      />
                    </td>
                    <td className="border-b p-2">
                      <ShowHide
                        value={n.showOnWeb === false ? false : n.showPrices}
                        disabled={n.showOnWeb === false}
                        missing={l.include && n.showOnWeb === true && empty(n.showPrices)}
                        ai={isAi(l.lineNo, "showPrices")}
                        onChange={(v) => update([l.lineNo], { showPrices: v })}
                      />
                    </td>
                    <td className="whitespace-nowrap border-b p-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Copy this row's details to other rows"
                          >
                            <Copy />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 space-y-1 p-2">
                          <p className="px-2 py-1 text-xs text-muted-foreground">
                            Copy {l.itemCode}'s category, unit, sub activity, status, website and
                            B2B to:
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start"
                            disabled={!picked.size}
                            onClick={() => copyFrom(l, "ticked")}
                          >
                            Ticked rows ({[...picked].filter((x) => x !== l.lineNo).length})
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => copyFrom(l, "empty")}
                          >
                            Every row, only where empty
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => copyFrom(l, "all")}
                          >
                            Every row, replacing what's there
                          </Button>
                        </PopoverContent>
                      </Popover>
                      {known.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Suggest from a similar code"
                          onClick={() => {
                            const s = suggest(l);
                            if (s) update([l.lineNo], s);
                            else toast("No similar code found");
                          }}
                        >
                          <Wand2 />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {subs.length === 0 && (
          <p className="text-xs text-warning">
            This brand has no Sub Activities yet. An admin adds them in Admin settings → Brands.
          </p>
        )}
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
        <Button disabled={busy} onClick={() => (missing.length ? setPopup(true) : void next())}>
          Continue to Suppliers
        </Button>
      </div>
      <Dialog open={popup} onOpenChange={setPopup}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {missing.length} field{missing.length === 1 ? " is" : "s are"} still empty
            </DialogTitle>
            <DialogDescription>
              You can fill them now, or continue and the reviewer fills them in. Tickets with empty
              fields can take longer.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 space-y-1 overflow-auto text-sm">
            {missing.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => {
                    setPopup(false);
                    if (m.lineNo)
                      document
                        .getElementById(`line-${m.lineNo}`)
                        ?.scrollIntoView({ block: "center" });
                  }}
                >
                  {m.message}
                </button>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPopup(false)}>
              Fill them in
            </Button>
            <Button
              onClick={() => {
                setPopup(false);
                void next();
              }}
            >
              Continue anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Three linked drop-downs: each list only shows options under the one above it. */
function CategoryPicker({
  cats,
  value,
  onChange,
  cells,
  missClass,
}: {
  cats: CategoryRow[];
  value: Fields;
  onChange: (v: Fields) => void;
  cells?: boolean;
  missClass?: (v: unknown) => string;
}) {
  const fam = familyOptions(cats);
  const grp = value.familyCode ? groupOptions(cats, value.familyCode) : [];
  const cat =
    value.familyCode && value.groupCode
      ? categoryOptions(cats, value.familyCode, value.groupCode)
      : [];
  const m = missClass ?? (() => "");
  const a = (
    <select
      className={`${sel} ${cells ? "w-36" : ""} ${m(value.familyCode)}`}
      value={value.familyCode ?? ""}
      onChange={(e) => onChange({ familyCode: e.target.value, groupCode: "", subCategoryCode: "" })}
    >
      <option value="">{cells ? "" : "Family"}</option>
      {fam.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const b = (
    <select
      className={`${sel} ${cells ? "w-44" : ""} ${m(value.groupCode)}`}
      value={value.groupCode ?? ""}
      disabled={!value.familyCode}
      onChange={(e) => onChange({ groupCode: e.target.value, subCategoryCode: "" })}
    >
      <option value="">{cells ? "" : "Group"}</option>
      {grp.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const c = (
    <select
      className={`${sel} ${cells ? "w-52" : ""} ${m(value.subCategoryCode)}`}
      value={value.subCategoryCode ?? ""}
      disabled={!value.groupCode}
      onChange={(e) => onChange({ subCategoryCode: e.target.value })}
    >
      <option value="">{cells ? "" : "Category"}</option>
      {cat.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (cells)
    return (
      <>
        <td className="border-b p-2">{a}</td>
        <td className="border-b p-2">{b}</td>
        <td className="border-b p-2">{c}</td>
      </>
    );
  return (
    <>
      {a}
      {b}
      {c}
    </>
  );
}
