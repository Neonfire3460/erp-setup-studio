// View ERP data: what a brand has in each entity's ERP today. Brand managers filter (Active / Inactive, entity,
// category, web), tick items page by page or "select all matching", make them inactive or active, then send
// the changes to the reviewer as an Active/Inactive ticket. Waiting and approved changes show in place.
// Brands can have 2,000+ codes, so the table renders one page (50 by default) at a time.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Search,
  Send,
  Tag,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandCombo } from "@/components/v3/BrandCombo";
import { DateField } from "@/components/v3/DateField";
import { Empty, PageHeader, errText, fmtNum } from "@/components/v3/ui";
import { downloadBlob, headFor, XLSX_TYPE } from "@/lib/v3/page";
import { wizardOptions } from "@/lib/v3/wizard.functions";
import { itemsBrowse, submitStatusChange } from "@/lib/v3/status.functions";
import { REVIEW_DAYS, earliestNeededBy, fmtDay, isoDate, today } from "@/lib/nmk/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/erp-items")({
  head: () =>
    headFor("View ERP data", "See a brand's items in the ERP and make items active or inactive."),
  component: Page,
});

type Data = Awaited<ReturnType<typeof itemsBrowse>>;
type Item = Data["items"][number];
const keyOf = (i: Pick<Item, "entityCode" | "itemCode">) => `${i.entityCode}|${i.itemCode}`;
const SIZES = [50, 100, 200] as const;

function Page() {
  const qc = useQueryClient();
  const opts = useQuery({
    queryKey: ["wizard-options"],
    queryFn: () => wizardOptions(),
    staleTime: 60_000,
  });
  const [brand, setBrand] = useState("");
  const [entity, setEntity] = useState<string>("all");
  const [cats, setCats] = useState(false);
  const [q, setQ] = useState("");
  const [moves, setMoves] = useState<Map<string, 0 | 1>>(new Map());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [neededBy, setNeededBy] = useState<string | undefined>();
  const [effective, setEffective] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [cat, setCat] = useState("all");
  const [web, setWeb] = useState<"any" | "on" | "off">("any");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(50);

  const data = useQuery({
    queryKey: ["erp-items", brand],
    queryFn: () => itemsBrowse({ data: { brand } }),
    enabled: !!brand,
    staleTime: 30_000,
  });
  const items = useMemo(() => data.data?.items ?? [], [data.data]);
  const ents = data.data?.entities ?? [];
  const stateOf = (i: Item) => moves.get(keyOf(i)) ?? i.inactive;
  // Filter everything except status first, so the tab counts match the other filters.
  const base = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (entity === "all" || i.entityCode === entity) &&
        (cat === "all" || (i.family ?? "") === cat) &&
        (web === "any" || (web === "on" ? i.web === 1 : i.web !== 1)) &&
        (!s || i.itemCode.toLowerCase().includes(s) || i.description.toLowerCase().includes(s)),
    );
  }, [items, entity, cat, web, q]);
  const nActive = base.filter((i) => stateOf(i) === 0).length;
  const shown =
    status === "all" ? base : base.filter((i) => stateOf(i) === (status === "active" ? 0 : 1));
  const pages = Math.max(1, Math.ceil(shown.length / size));
  const cur = Math.min(page, pages - 1);
  const rows = shown.slice(cur * size, cur * size + size);
  const families = useMemo(
    () => [...new Set(items.map((i) => i.family).filter((f): f is string => !!f))].sort(),
    [items],
  );
  const byKey = useMemo(() => new Map(items.map((i) => [keyOf(i), i])), [items]);
  const changes = [...moves.entries()].filter(([k, v]) => byKey.get(k)?.inactive !== v);
  const toIn = changes.filter(([, v]) => v === 1).length;

  const move = (keys: string[], to: 0 | 1) => {
    const locked = keys.filter((k) => byKey.get(k)?.change?.state === "pending");
    setMoves((m) => {
      const n = new Map(m);
      for (const k of keys) {
        const it = byKey.get(k);
        if (!it || locked.includes(k)) continue;
        if (it.inactive === to) n.delete(k);
        else n.set(k, to);
      }
      return n;
    });
    setPicked(new Set());
    if (keys.length > locked.length)
      toast.success(
        `${keys.length - locked.length} item${keys.length - locked.length === 1 ? "" : "s"} marked ${to ? "inactive" : "active"}. Send for review when you're ready.`,
      );
    if (locked.length)
      toast.warning(
        `${locked.length} item${locked.length === 1 ? " is" : "s are"} already waiting in a request, so ${locked.length === 1 ? "it" : "they"} stayed.`,
      );
  };

  async function send() {
    if (!neededBy || neededBy < isoDate(earliestNeededBy())) {
      toast.error("Pick the date you need this by");
      return;
    }
    setSending(true);
    try {
      const r = await submitStatusChange({
        data: {
          brand,
          neededBy,
          effectiveFrom: effective ?? null,
          note,
          changes: changes.map(([k, v]) => {
            const it = byKey.get(k)!;
            return { entityCode: it.entityCode, itemCode: it.itemCode, inactive: v };
          }),
        },
      });
      toast.success(
        `Sent as ${r.ticketNo}: ${r.changes} change${r.changes === 1 ? "" : "s"}. The reviewer has it.`,
      );
      setMoves(new Map());
      setDialog(false);
      setNote("");
      await qc.invalidateQueries({ queryKey: ["erp-items", brand] });
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setSending(false);
    }
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      shown.map((i) => ({
        "Item Code": i.itemCode,
        Description: i.description,
        Entity: i.entityCode,
        Status: stateOf(i) === 1 ? "Inactive" : "Active",
        Web: i.web === 1 ? "Shown" : "Hidden",
        "B2B prices": i.b2b === 1 ? "Shown" : "Hidden",
        Cost: i.cost ?? "",
        "Cost currency": i.costCurrency ?? "",
        Retail: i.retail ?? "",
        "Max discount %": i.maxDiscount ?? "",
        Family: i.family ?? "",
        Group: i.group ?? "",
        Category: i.category ?? "",
        "Sub category": i.subCategory ?? "",
        "Midwich family": i.midwich ?? "",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ERP data");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    downloadBlob(
      new Blob([buf], { type: XLSX_TYPE }),
      `${brand} ERP data ${isoDate(today())}.xlsx`.replace(/[\\/:*?"<>|]+/g, "-"),
    );
  }

  const brands = (opts.data?.brands ?? []).map((b) => b.brand_activity);
  const reset = () => {
    setPage(0);
    setPicked(new Set());
  };
  const pageKeys = rows.filter((i) => i.change?.state !== "pending").map(keyOf);
  const pageAll = pageKeys.length > 0 && pageKeys.every((k) => picked.has(k));
  const sel = [...picked];
  const selActive = sel.filter((k) => {
    const it = byKey.get(k);
    return it && stateOf(it) === 0;
  });
  const selInactive = sel.length - selActive.length;
  const statusWord = status === "all" ? "" : `${status} `;
  return (
    <div className="min-w-0 space-y-4 pb-28">
      <PageHeader
        title={brand ? `${brand} in the ERP` : "View ERP data"}
        description={
          items.length > 0
            ? `${fmtNum(items.length)} items in ${ents.length} entit${ents.length === 1 ? "y" : "ies"}. Tick items to make them active or inactive, then send for review.`
            : "Pick a brand to see its items exactly as they are in the ERP."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BrandCombo
              brands={brands}
              value={brand}
              onChange={(b) => {
                if (changes.length && !window.confirm("Drop the changes you haven't sent?")) return;
                setBrand(b);
                setMoves(new Map());
                setEntity("all");
                setCat("all");
                reset();
              }}
              className="h-11 w-64 bg-card"
            />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search"
                className="h-11 w-72 pl-9"
                placeholder="Search code or description"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  reset();
                }}
              />
            </div>
            <Button
              variant="outline"
              className="h-11"
              disabled={!shown.length}
              onClick={() => void exportExcel()}
            >
              <Download />
              Export to Excel
            </Button>
          </div>
        }
      />

      {!brand && (
        <Empty
          icon={Tag}
          text={
            opts.data?.brandScoped && !brands.length
              ? "No brands on your account yet. Ask an admin to add yours in Admin settings → Users."
              : "Pick a brand to see its items in the ERP."
          }
        />
      )}
      {data.isLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading {brand} from the ERP data...
        </p>
      )}
      {data.error && <p className="text-sm text-destructive">{errText(data.error)}</p>}
      {brand && data.data && !items.length && (
        <Empty icon={Tag} text={`No ${brand} items in the ERP data yet.`} />
      )}

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border bg-card p-3">
            <div role="group" aria-label="Status" className="flex rounded-[10px] bg-muted p-1">
              {(
                [
                  ["active", `Active ${fmtNum(nActive)}`],
                  ["inactive", `Inactive ${fmtNum(base.length - nActive)}`],
                  ["all", "All"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setStatus(v);
                    reset();
                  }}
                  className={cn(
                    "h-9 rounded-lg px-3.5 text-sm font-bold text-muted-foreground transition",
                    status === v && "bg-card text-foreground shadow-sm",
                    status === v && v === "active" && "text-success",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="h-7 w-px bg-border" />
            <FilterSelect
              label="Entity"
              value={entity}
              onChange={(v) => {
                setEntity(v);
                reset();
              }}
              options={[
                ["all", "All entities"],
                ...ents.map(
                  (e) => [e.code, `${e.code} · ${e.name} (${e.count})`] as [string, string],
                ),
              ]}
            />
            <FilterSelect
              label="Category"
              value={cat}
              onChange={(v) => {
                setCat(v);
                reset();
              }}
              options={[
                ["all", "Every category"],
                ...families.map((f) => [f, f] as [string, string]),
              ]}
            />
            <FilterSelect
              label="Website"
              value={web}
              onChange={(v) => {
                setWeb(v as typeof web);
                reset();
              }}
              options={[
                ["any", "Web: any"],
                ["on", "Shown on web"],
                ["off", "Hidden from web"],
              ]}
            />
            <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
              <Switch checked={cats} onCheckedChange={setCats} />
              Show categories
            </label>
          </div>

          {picked.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm">
              <b>
                {fmtNum(picked.size)} selected
                {picked.size === pageKeys.filter((k) => picked.has(k)).length
                  ? " on this page"
                  : ""}
                .
              </b>
              {shown.length > picked.size && (
                <button
                  type="button"
                  className="font-bold text-primary hover:underline"
                  onClick={() =>
                    setPicked(
                      new Set(shown.filter((i) => i.change?.state !== "pending").map(keyOf)),
                    )
                  }
                >
                  Select all {fmtNum(shown.length)} {statusWord}items
                </button>
              )}
              <span className="ml-auto flex flex-wrap gap-2">
                {selActive.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-slate-700 hover:bg-slate-800"
                    onClick={() => move(selActive, 1)}
                  >
                    Make {fmtNum(selActive.length)} inactive
                  </Button>
                )}
                {selInactive > 0 && (
                  <Button
                    size="sm"
                    className="bg-success text-white hover:bg-success/90"
                    onClick={() => {
                      const a = new Set(selActive);
                      move(
                        sel.filter((k) => !a.has(k)),
                        0,
                      );
                    }}
                  >
                    Make {fmtNum(selInactive)} active
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setPicked(new Set())}>
                  Clear
                </Button>
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-[14px] border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-10 px-3.5 py-3">
                      <Checkbox
                        aria-label="Select this page"
                        checked={pageAll}
                        onCheckedChange={(v) =>
                          setPicked((p) => {
                            const n = new Set(p);
                            pageKeys.forEach((k) => (v === true ? n.add(k) : n.delete(k)));
                            return n;
                          })
                        }
                      />
                    </th>
                    <th className="px-2 py-3">Item code</th>
                    <th className="px-2 py-3">Description</th>
                    {entity === "all" && <th className="px-2 py-3">Entity</th>}
                    <th className="px-2 py-3">Web</th>
                    <th className="px-2 py-3">B2B prices</th>
                    <th className="px-2 py-3 text-right">Cost</th>
                    <th className="px-2 py-3 text-right">Retail</th>
                    <th className="px-2 py-3 text-right">Max disc.</th>
                    <th className="px-3.5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <Row
                      key={keyOf(i)}
                      i={i}
                      picked={picked.has(keyOf(i))}
                      setPicked={setPicked}
                      state={stateOf(i)}
                      mine={moves.has(keyOf(i)) && moves.get(keyOf(i)) !== i.inactive}
                      cats={cats}
                      showEntity={entity === "all"}
                      undo={() =>
                        setMoves((m) => {
                          const n = new Map(m);
                          n.delete(keyOf(i));
                          return n;
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  Nothing matches these filters.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>
                Showing{" "}
                <b className="text-foreground">
                  {shown.length ? fmtNum(cur * size + 1) : 0}–{fmtNum(cur * size + rows.length)}
                </b>{" "}
                of <b className="text-foreground">{fmtNum(shown.length)}</b> {statusWord}items
              </span>
              <span className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9"
                  aria-label="Previous page"
                  disabled={cur === 0}
                  onClick={() => setPage(cur - 1)}
                >
                  <ChevronLeft />
                </Button>
                {pageList(cur, pages).map((n, idx) =>
                  n === null ? (
                    <span key={`gap${idx}`} className="px-1">
                      …
                    </span>
                  ) : (
                    <Button
                      key={n}
                      size="icon"
                      variant={n === cur ? "default" : "outline"}
                      className="size-9"
                      onClick={() => setPage(n)}
                    >
                      {n + 1}
                    </Button>
                  ),
                )}
                <Button
                  size="icon"
                  variant="outline"
                  className="size-9"
                  aria-label="Next page"
                  disabled={cur >= pages - 1}
                  onClick={() => setPage(cur + 1)}
                >
                  <ChevronRight />
                </Button>
                <select
                  aria-label="Rows per page"
                  className="ml-2 h-9 rounded-lg border bg-card px-2 text-sm"
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(0);
                  }}
                >
                  {SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>
        </>
      )}

      {changes.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-6xl rounded-2xl bg-[#0B1460] text-white shadow-[0_16px_36px_rgba(11,20,96,0.3)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-[15px]">
              <b className="text-lg">
                {fmtNum(changes.length)} change{changes.length === 1 ? "" : "s"} ready
              </b>{" "}
              <span className="text-white/80">
                · {fmtNum(toIn)} to inactive · {fmtNum(changes.length - toIn)} to active · not sent
                yet
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMoves(new Map())}
              >
                <Undo2 />
                Undo all
              </Button>
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#5B4CF0] to-[#1FB7B5] font-extrabold hover:opacity-95"
                onClick={() => setDialog(true)}
              >
                <Send />
                Send for review
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Send {fmtNum(changes.length)} change{changes.length === 1 ? "" : "s"} for review
            </DialogTitle>
            <DialogDescription>
              The reviewer checks them, then the change goes to the ERP. This takes at least{" "}
              {REVIEW_DAYS} days, so the earliest date is {fmtDay(isoDate(earliestNeededBy()))}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-2 text-xs">
              {changes.slice(0, 200).map(([k, v]) => {
                const it = byKey.get(k);
                return (
                  <p key={k} className="flex justify-between gap-2 py-0.5">
                    <span className="font-semibold">
                      {it?.itemCode}{" "}
                      <span className="font-normal text-muted-foreground">{it?.entityCode}</span>
                    </span>
                    <span>{v ? "→ Inactive" : "→ Active"}</span>
                  </p>
                );
              })}
              {changes.length > 200 && (
                <p className="pt-1 text-muted-foreground">and {changes.length - 200} more</p>
              )}
            </div>
            <DateField
              label="Needed by (required)"
              value={neededBy}
              min={earliestNeededBy()}
              onChange={setNeededBy}
            />
            <DateField
              label="In effect from (optional)"
              value={effective}
              min={today()}
              onChange={setEffective}
              clearable
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Note for the reviewer (optional)</p>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='For example "Discontinued by the vendor in Q4"'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button disabled={sending || !neededBy} onClick={() => void send()}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              Send for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Page buttons: first, last, and two either side of the current page. */
function pageList(cur: number, pages: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let n = 0; n < pages; n++) {
    if (n === 0 || n === pages - 1 || Math.abs(n - cur) <= 1) out.push(n);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 max-w-[220px] rounded-[10px] border-[1.5px] bg-card px-2.5 text-sm font-semibold"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Every category level as its own chip, wrapping onto a second line when it's long. */
function CategoryPath({ i }: { i: Item }) {
  const levels = [
    ["Family", i.family],
    ["Group", i.group],
    ["Category", i.category],
    ["Sub category", i.subCategory],
  ].filter((x): x is [string, string] => !!x[1]);
  if (!levels.length && !i.midwich) return <p className="mt-1 text-[12px] italic">No category</p>;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {levels.map(([label, v], n) => (
        <span key={label} className="flex items-center gap-1">
          {n > 0 && <span className="text-[11px] text-muted-foreground/60">›</span>}
          <span
            title={label}
            className="rounded-md bg-[#EEF0FF] px-1.5 py-0.5 text-[11px] font-semibold text-[#3730A3]"
          >
            {v}
          </span>
        </span>
      ))}
      {i.midwich && (
        <span
          title="Midwich family"
          className="ml-1 rounded-md bg-[#E6FAF9] px-1.5 py-0.5 text-[11px] font-semibold text-[#0F766E]"
        >
          Midwich: {i.midwich}
        </span>
      )}
    </div>
  );
}

const Shown = ({ on }: { on: number | null }) => (
  <span
    className={cn("text-[13px] font-bold", on === 1 ? "text-success" : "text-muted-foreground")}
  >
    {on === 1 ? "Shown" : "Hidden"}
  </span>
);

function Row({
  i,
  picked,
  setPicked,
  state,
  mine,
  cats,
  showEntity,
  undo,
}: {
  i: Item;
  picked: boolean;
  setPicked: (f: (s: Set<string>) => Set<string>) => void;
  state: 0 | 1;
  mine: boolean;
  cats: boolean;
  showEntity: boolean;
  undo: () => void;
}) {
  const k = keyOf(i);
  const waiting = i.change?.state === "pending";
  const approved = i.change?.state === "approved";
  return (
    <tr
      className={cn(
        "border-t align-top",
        picked && "bg-accent/50",
        waiting && "bg-warning-soft/40",
      )}
    >
      <td className="px-3.5 py-2.5">
        <Checkbox
          aria-label={`Select ${i.itemCode}`}
          disabled={waiting}
          checked={picked}
          onCheckedChange={(v) =>
            setPicked((p) => {
              const n = new Set(p);
              if (v === true) n.add(k);
              else n.delete(k);
              return n;
            })
          }
        />
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 font-bold">{i.itemCode}</td>
      <td
        className={cn(
          "px-2 py-2.5 text-muted-foreground",
          cats ? "min-w-[380px]" : "max-w-[360px]",
        )}
      >
        <p className={cats ? "" : "truncate"} title={i.description}>
          {i.description}
        </p>
        {cats && <CategoryPath i={i} />}
      </td>
      {showEntity && (
        <td className="px-2 py-2.5">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold">{i.entityCode}</span>
        </td>
      )}
      <td className="px-2 py-2.5">
        <Shown on={i.web} />
      </td>
      <td className="px-2 py-2.5">
        <Shown on={i.b2b} />
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
        {fmtNum(i.cost)} <span className="text-xs text-muted-foreground">{i.costCurrency}</span>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(i.retail)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">
        {i.maxDiscount === null || i.maxDiscount === undefined ? "-" : `${i.maxDiscount}%`}
      </td>
      <td className="whitespace-nowrap px-3.5 py-2.5">
        {waiting ? (
          <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold text-warning">
            Waiting for review · {i.change!.ticketNo}
          </span>
        ) : approved ? (
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
            Approved · going into the ERP
          </span>
        ) : mine ? (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-primary">
            Will be {state ? "inactive" : "active"} ·{" "}
            <button type="button" className="underline" onClick={undo}>
              undo
            </button>
          </span>
        ) : (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-bold",
              state ? "bg-muted text-muted-foreground" : "bg-success-soft text-success",
            )}
          >
            {state ? "Inactive" : "Active"}
          </span>
        )}
      </td>
    </tr>
  );
}
