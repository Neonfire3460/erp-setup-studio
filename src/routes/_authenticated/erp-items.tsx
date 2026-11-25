// ERP Items: what a brand has in each entity's ERP today, split Active and Inactive. Brand managers move items
// between the two lists (tick several, or drag), then send the changes to the reviewer as an Active/Inactive
// ticket. Waiting and approved changes show in place, so the page always reflects what they asked for.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  CircleCheck,
  CircleSlash,
  Globe,
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
import { Card, Empty, Label11, PageHeader, errText, fmtNum } from "@/components/v3/ui";
import { headFor } from "@/lib/v3/page";
import { wizardOptions } from "@/lib/v3/wizard.functions";
import { itemsBrowse, submitStatusChange } from "@/lib/v3/status.functions";
import { REVIEW_DAYS, earliestNeededBy, fmtDay, isoDate, today } from "@/lib/nmk/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/erp-items")({
  head: () =>
    headFor("ERP Items", "See a brand's items in the ERP and make items active or inactive."),
  component: Page,
});

type Data = Awaited<ReturnType<typeof itemsBrowse>>;
type Item = Data["items"][number];
const keyOf = (i: Pick<Item, "entityCode" | "itemCode">) => `${i.entityCode}|${i.itemCode}`;
const PAGE = 300;

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
  const [over, setOver] = useState<0 | 1 | null>(null);

  const data = useQuery({
    queryKey: ["erp-items", brand],
    queryFn: () => itemsBrowse({ data: { brand } }),
    enabled: !!brand,
    staleTime: 30_000,
  });
  const items = useMemo(() => data.data?.items ?? [], [data.data]);
  const ents = data.data?.entities ?? [];
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (entity === "all" || i.entityCode === entity) &&
        (!s || i.itemCode.toLowerCase().includes(s) || i.description.toLowerCase().includes(s)),
    );
  }, [items, entity, q]);
  const stateOf = (i: Item) => moves.get(keyOf(i)) ?? i.inactive;
  const active = shown.filter((i) => stateOf(i) === 0);
  const inactive = shown.filter((i) => stateOf(i) === 1);
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

  const brands = (opts.data?.brands ?? []).map((b) => b.brand_activity);
  return (
    <div className="min-w-0 space-y-6 pb-28">
      <PageHeader
        title="ERP Items"
        description="What each entity's ERP has for a brand today. Move items between Active and Inactive, then send the changes to the admin."
      />
      <Card className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-sm">
          <Label11>Brand</Label11>
          <BrandCombo
            brands={brands}
            value={brand}
            onChange={(b) => {
              if (changes.length && !window.confirm("Drop the changes you haven't sent?")) return;
              setBrand(b);
              setMoves(new Map());
              setPicked(new Set());
              setEntity("all");
            }}
            className="mt-1 h-11 w-full text-base"
          />
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Search code or description"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex h-11 items-center gap-2 text-sm">
          <Switch checked={cats} onCheckedChange={setCats} />
          Show categories (with Midwich Family)
        </label>
      </Card>

      {!brand && <Empty icon={Tag} text="Pick a brand to see its items in the ERP." />}
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
          <div className="flex flex-wrap gap-2">
            {[{ code: "all", name: "All entities", count: items.length }, ...ents].map((e) => (
              <button
                key={e.code}
                type="button"
                onClick={() => setEntity(e.code)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                  entity === e.code
                    ? "border-primary bg-primary text-primary-foreground shadow"
                    : "bg-card hover:border-primary",
                )}
              >
                {e.code === "all" ? e.name : `${e.code} · ${e.name}`}{" "}
                <span className="opacity-70">{e.count}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {([0, 1] as const).map((side) => {
              const list = side === 0 ? active : inactive;
              const sel = list.filter((i) => picked.has(keyOf(i)));
              return (
                <section
                  key={side}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(side);
                  }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    const keys = (e.dataTransfer.getData("text/plain") || "")
                      .split("\n")
                      .filter(Boolean);
                    if (keys.length) move(keys, side);
                  }}
                  className={cn(
                    "min-w-0 space-y-3 rounded-[14px] border-2 bg-card p-4 transition",
                    side === 0 ? "border-success/30" : "border-muted-foreground/20",
                    over === side && "border-dashed border-primary bg-accent/40",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      {side === 0 ? (
                        <CircleCheck className="size-5 text-success" />
                      ) : (
                        <CircleSlash className="size-5 text-muted-foreground" />
                      )}
                      {side === 0 ? "Active" : "Inactive / discontinued"}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-semibold text-muted-foreground">
                        {list.length}
                      </span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={list.length > 0 && sel.length === list.length}
                          onCheckedChange={(v) =>
                            setPicked((p) => {
                              const n = new Set(p);
                              list.forEach((i) =>
                                v === true ? n.add(keyOf(i)) : n.delete(keyOf(i)),
                              );
                              return n;
                            })
                          }
                        />
                        Select all
                      </label>
                      <Button
                        size="sm"
                        disabled={!sel.length}
                        variant={side === 0 ? "outline" : "default"}
                        onClick={() => move(sel.map(keyOf), side === 0 ? 1 : 0)}
                      >
                        <ArrowLeftRight />
                        Move {sel.length || ""} to {side === 0 ? "Inactive" : "Active"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tick items and press Move, or drag them to the other list.
                  </p>
                  <List
                    list={list}
                    picked={picked}
                    setPicked={setPicked}
                    moves={moves}
                    cats={cats}
                    showEntity={entity === "all"}
                    undo={(k) =>
                      setMoves((m) => {
                        const n = new Map(m);
                        n.delete(k);
                        return n;
                      })
                    }
                  />
                </section>
              );
            })}
          </div>
        </>
      )}

      {changes.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm">
              <b className="text-base">
                {changes.length} change{changes.length === 1 ? "" : "s"} ready
              </b>{" "}
              <span className="text-muted-foreground">
                · {toIn} to Inactive · {changes.length - toIn} to Active · not sent yet
              </span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setMoves(new Map())}>
                <Undo2 />
                Undo all
              </Button>
              <Button size="lg" onClick={() => setDialog(true)}>
                <Send />
                Send to admin
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Send {changes.length} change{changes.length === 1 ? "" : "s"} to the admin
            </DialogTitle>
            <DialogDescription>
              The reviewer checks them, then the change goes to the ERP. This takes at least{" "}
              {REVIEW_DAYS} days, so the earliest date is {fmtDay(isoDate(earliestNeededBy()))}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              <p className="text-sm font-semibold">Note for the admin (optional)</p>
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
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Flag = ({ on, label }: { on: number | null; label: string }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
      on === 1 ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
    )}
  >
    <Globe className="size-3" />
    {label} {on === 1 ? "on" : "off"}
  </span>
);

function List({
  list,
  picked,
  setPicked,
  moves,
  cats,
  showEntity,
  undo,
}: {
  list: Item[];
  picked: Set<string>;
  setPicked: (f: (s: Set<string>) => Set<string>) => void;
  moves: Map<string, 0 | 1>;
  cats: boolean;
  showEntity: boolean;
  undo: (k: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  if (!list.length)
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nothing here. Drop items here to move them.
      </p>
    );
  return (
    <div className="max-h-[70vh] space-y-1.5 overflow-auto pr-1">
      {list.slice(0, limit).map((i) => {
        const k = keyOf(i);
        const mine = moves.has(k) && moves.get(k) !== i.inactive;
        const waiting = i.change?.state === "pending";
        const approved = i.change?.state === "approved";
        return (
          <div
            key={k}
            draggable={!waiting}
            onDragStart={(e) => {
              const keys = picked.has(k) ? [...picked] : [k];
              e.dataTransfer.setData("text/plain", keys.join("\n"));
              e.dataTransfer.effectAllowed = "move";
            }}
            className={cn(
              "group flex gap-3 rounded-lg border bg-background p-2.5 transition hover:border-primary/50 hover:shadow-sm",
              !waiting && "cursor-grab active:cursor-grabbing",
              picked.has(k) && "border-primary bg-accent/50",
              mine && "border-l-4 border-l-primary",
              waiting && "border-l-4 border-l-warning bg-warning-soft/40",
              approved && "border-l-4 border-l-success",
            )}
          >
            <Checkbox
              className="mt-0.5"
              disabled={waiting}
              checked={picked.has(k)}
              onCheckedChange={(v) =>
                setPicked((p) => {
                  const n = new Set(p);
                  if (v === true) n.add(k);
                  else n.delete(k);
                  return n;
                })
              }
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{i.itemCode}</span>
                {showEntity && (
                  <span className="rounded bg-muted px-1.5 text-[11px] font-semibold">
                    {i.entityCode}
                  </span>
                )}
                <Flag on={i.web} label="Web" />
                <Flag on={i.b2b} label="B2B" />
                {mine && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <ArrowRight className="size-3" />
                    Your change, not sent
                    <button type="button" className="ml-1 underline" onClick={() => undo(k)}>
                      undo
                    </button>
                  </span>
                )}
                {waiting && (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                    Waiting for review · {i.change!.ticketNo}
                  </span>
                )}
                {approved && (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    Approved · {i.change!.ticketNo} · going into the ERP
                  </span>
                )}
              </div>
              <p className="truncate text-[13px] text-muted-foreground" title={i.description}>
                {i.description}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] tabular-nums">
                <span>
                  <span className="text-muted-foreground">Cost</span> <b>{fmtNum(i.cost)}</b>{" "}
                  {i.costCurrency}
                </span>
                <span>
                  <span className="text-muted-foreground">Retail</span> <b>{fmtNum(i.retail)}</b>
                </span>
                <span>
                  <span className="text-muted-foreground">Max discount</span>{" "}
                  <b>{i.maxDiscount ?? "-"}%</b>
                </span>
              </div>
              {cats && (
                <p className="text-[12px] text-muted-foreground">
                  {[i.family, i.group, i.category, i.subCategory].filter(Boolean).join(" › ") ||
                    "No category"}
                  {i.midwich ? ` · Midwich: ${i.midwich}` : ""}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {list.length > limit && (
        <Button variant="ghost" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, list.length - limit)} more of {list.length - limit}
        </Button>
      )}
    </div>
  );
}
