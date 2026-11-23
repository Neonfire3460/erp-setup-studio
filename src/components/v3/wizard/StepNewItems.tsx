// Step 4: register new items. Family > Group > Category in words (codes kept), Midwich shown greyed,
// unit, sub activity, ERP status, show on website. Bulk fill for ticked rows, and a suggestion from similar codes.
import { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, Label11, fmtNum } from "@/components/v3/ui";
import {
  categoryBySub,
  categoryOptions,
  familyOptions,
  groupOptions,
  suggestCategory,
  type CategoryRow,
} from "@/lib/nmk/categories";
import type { NewItemFields, TicketLine } from "@/lib/nmk/types";
import { brandOf, toCategoryRows, type PriceCheckData, type StepProps } from "./shared";

const sel = "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-[13px]";
type Fields = Partial<NewItemFields>;

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
  const known = pc?.known ?? [];

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
        return {
          ...l,
          ...(include === undefined ? {} : { include }),
          newItem: { ...l.newItem, ...patch },
        };
      }),
    }));
  };
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
    for (const l of lines) {
      const s = suggest(l);
      if (s && !l.newItem?.subCategoryCode) update([l.lineNo], s);
    }
  };
  const allPicked = lines.length > 0 && lines.every((l) => picked.has(l.lineNo));

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label11>Register new items ({lines.length})</Label11>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill every column. Untick "Register" to leave a code out of this ticket. Sub Category
              and Midwich come from the Category.
            </p>
          </div>
          {known.length > 0 && (
            <Button size="sm" variant="outline" onClick={suggestAll}>
              <Wand2 />
              Suggest categories from similar codes
            </Button>
          )}
        </div>
        {picked.size > 0 && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-accent/50 p-3">
            <p className="text-sm font-semibold">
              Set for {picked.size} ticked row{picked.size === 1 ? "" : "s"}
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
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
              <select
                className={sel}
                value={
                  bulk.showOnWeb === undefined || bulk.showOnWeb === null
                    ? ""
                    : bulk.showOnWeb
                      ? "1"
                      : "0"
                }
                onChange={(e) =>
                  setBulk((b) => ({
                    ...b,
                    showOnWeb: e.target.value === "" ? null : e.target.value === "1",
                  }))
                }
              >
                <option value="">Show on website</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const f = Object.fromEntries(
                    Object.entries(bulk).filter(
                      ([, v]) => v !== "" && v !== undefined && v !== null,
                    ),
                  ) as Fields;
                  update([...picked], f);
                  setBulk({});
                }}
              >
                Apply to ticked rows
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
                Untick all
              </Button>
            </div>
          </div>
        )}
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
                  "Show on website",
                  "",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap p-2">
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
                  l.include && (v === "" || v === null || v === undefined)
                    ? "border-destructive/60 bg-destructive-soft/40"
                    : "";
                return (
                  <tr
                    key={l.lineNo}
                    id={`line-${l.lineNo}`}
                    className={l.include ? "" : "opacity-50"}
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
                    <td className="whitespace-nowrap border-b p-2 font-semibold">{l.itemCode}</td>
                    <td className="max-w-64 truncate border-b p-2" title={l.description}>
                      {l.description}
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
                        className={`h-8 w-64 ${miss(n.altDescription)}`}
                        value={n.altDescription}
                        onChange={(e) => update([l.lineNo], { altDescription: e.target.value })}
                      />
                    </td>
                    <CategoryPicker
                      cats={cats}
                      value={n}
                      onChange={(v) => update([l.lineNo], v)}
                      cells
                      missClass={miss}
                    />
                    <td className="whitespace-nowrap border-b p-2 text-muted-foreground">
                      {cat?.midwichName || cat?.midwichCode || ""}
                    </td>
                    <td className="border-b p-2">
                      <select
                        className={`${sel} w-28 ${miss(n.unitCode)}`}
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
                        className={`${sel} w-40 ${miss(n.subActivity)}`}
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
                      <select
                        className={`${sel} w-24 ${miss(n.showOnWeb)}`}
                        value={n.showOnWeb === null ? "" : n.showOnWeb ? "1" : "0"}
                        onChange={(e) =>
                          update([l.lineNo], {
                            showOnWeb: e.target.value === "" ? null : e.target.value === "1",
                          })
                        }
                      >
                        <option value="" />
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                      </select>
                    </td>
                    <td className="border-b p-2">
                      {known.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Suggest from a similar code"
                          onClick={() => {
                            const s = suggest(l);
                            if (s) update([l.lineNo], s);
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
        <Button disabled={busy} onClick={() => next()}>
          Continue to Suppliers
        </Button>
      </div>
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
