// Brands: entities, defaults, logo, sub activities, supplier per entity, pricing rules and the PDF item order.
import { useEffect, useMemo, useState } from "react";
import { FileUp, Loader2, Plus, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, Label11, errText, fmtDate } from "@/components/v3/ui";
import { defaultBrandLogo, fileToLogo } from "@/lib/v3/logo";
import { learnOrder, type PdfTextItem } from "@/lib/nmk/pdfOrder";
import { brandErpCodes } from "@/lib/v3/erp.functions";
import { cn } from "@/lib/utils";
import { ListEditor, loadAll, looseDb, type Row } from "./ListEditor";

type Brand = {
  brand_activity: string;
  active: boolean;
  default_max_discount: number | null;
  default_unit: string | null;
  entity_codes: string[];
  logo_path: string | null;
  last_currency: string | null;
};
type Ent = { code: string; name: string };
const like = (s: string) => s.replace(/[\\%_]/g, "\\$&");

async function pdfText(file: File): Promise<PdfTextItem[]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: PdfTextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items as { str?: string; transform?: number[]; fontName?: string }[])
      if (it.str && it.transform)
        out.push({
          page: p,
          x: it.transform[4]!,
          y: it.transform[5]!,
          str: it.str,
          ...(it.fontName ? { font: it.fontName } : {}),
        });
  }
  return out;
}

export function BrandsTab({
  entities,
  units,
  initialBrand,
}: {
  entities: Ent[];
  units: { code: string; name: string }[];
  initialBrand?: string | undefined;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string>(initialBrand ?? "");
  const [newBrand, setNewBrand] = useState("");
  async function load() {
    try {
      setBrands((await loadAll("brands", {}, "brand_activity")) as Brand[]);
    } catch (e) {
      toast.error(errText(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? brands.filter((b) => b.brand_activity.toLowerCase().includes(s)) : brands).slice(
      0,
      300,
    );
  }, [brands, q]);
  const brand =
    brands.find((b) => b.brand_activity === pick) ??
    brands.find((b) => b.brand_activity.toUpperCase() === pick.toUpperCase()) ??
    null;

  async function add() {
    const name = newBrand.trim();
    if (!name) return;
    const r = await looseDb.from("brands").insert({ brand_activity: name });
    if (r.error) {
      toast.error(r.error.message);
      return;
    }
    setNewBrand("");
    await load();
    setPick(name);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="space-y-2 self-start">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={`Search ${brands.length} brands`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[520px] overflow-auto">
          {shown.map((b) => (
            <button
              key={b.brand_activity}
              type="button"
              onClick={() => setPick(b.brand_activity)}
              className={cn(
                "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
                pick === b.brand_activity ? "bg-accent font-semibold" : "hover:bg-muted",
                !b.active && "text-muted-foreground line-through",
              )}
            >
              {b.brand_activity}
            </button>
          ))}
        </div>
        <div className="flex gap-2 border-t pt-2">
          <Input
            className="h-8"
            placeholder="New brand (as in the ERP)"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
          />
          <Button size="sm" onClick={add}>
            <Plus />
          </Button>
        </div>
      </Card>
      {brand ? (
        <BrandPanel
          key={brand.brand_activity}
          brand={brand}
          entities={entities}
          units={units}
          onSaved={load}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick a brand. New brands also arrive with every ERP import.
        </p>
      )}
    </div>
  );
}

function BrandPanel({
  brand,
  entities,
  units,
  onSaved,
}: {
  brand: Brand;
  entities: Ent[];
  units: { code: string; name: string }[];
  onSaved: () => Promise<void>;
}) {
  const [b, setB] = useState(brand);
  const [saving, setSaving] = useState(false);
  const [subs, setSubs] = useState<string[]>([]);
  const [newSub, setNewSub] = useState("");
  const [sup, setSup] = useState<Record<string, { supplier: string; supplier_name: string }>>({});
  const [order, setOrder] = useState<{
    item_codes: string[];
    source_file: string | null;
    updated_at: string;
  } | null>(null);
  const [learned, setLearned] = useState<(ReturnType<typeof learnOrder> & { file: string }) | null>(
    null,
  );
  const [reading, setReading] = useState(false);
  const name = brand.brand_activity;

  async function loadExtra() {
    const [s, p, o] = await Promise.all([
      looseDb
        .from("sub_activities")
        .select("sub_activity")
        .eq("brand_activity", name)
        .order("sub_activity"),
      looseDb
        .from("brand_suppliers")
        .select("entity_code,supplier,supplier_name")
        .eq("brand_activity", name),
      looseDb
        .from("pdf_orders")
        .select("item_codes,source_file,updated_at")
        .eq("brand_activity", name)
        .maybeSingle(),
    ]);
    setSubs((s.data ?? []).map((x: Row) => String(x["sub_activity"])));
    setSup(
      Object.fromEntries(
        (p.data ?? []).map((x: Row) => [
          String(x["entity_code"]),
          {
            supplier: String(x["supplier"] ?? ""),
            supplier_name: String(x["supplier_name"] ?? ""),
          },
        ]),
      ),
    );
    setOrder(o.data ?? null);
  }
  useEffect(() => {
    void loadExtra();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      const r = await looseDb
        .from("brands")
        .update({
          active: b.active,
          default_max_discount: b.default_max_discount,
          default_unit: b.default_unit || null,
          entity_codes: b.entity_codes,
          logo_path: b.logo_path,
        })
        .eq("brand_activity", name);
      if (r.error) throw new Error(r.error.message);
      const rows = Object.entries(sup)
        .filter(([, v]) => v.supplier.trim())
        .map(([entity_code, v]) => ({
          brand_activity: name,
          entity_code,
          supplier: v.supplier.trim(),
          supplier_name: v.supplier_name.trim(),
        }));
      if (rows.length) {
        const s = await looseDb
          .from("brand_suppliers")
          .upsert(rows, { onConflict: "brand_activity,entity_code" });
        if (s.error) throw new Error(s.error.message);
      }
      const gone = Object.entries(sup)
        .filter(([, v]) => !v.supplier.trim())
        .map(([e]) => e);
      if (gone.length)
        await looseDb
          .from("brand_suppliers")
          .delete()
          .eq("brand_activity", name)
          .in("entity_code", gone);
      toast.success("Saved");
      await onSaved();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function addSub() {
    const s = newSub.trim();
    if (!s) return;
    const r = await looseDb
      .from("sub_activities")
      .insert({ brand_activity: name, sub_activity: s });
    if (r.error) toast.error(r.error.message);
    else {
      setNewSub("");
      void loadExtra();
    }
  }
  async function removeSub(s: string) {
    const r = await looseDb
      .from("sub_activities")
      .delete()
      .match({ brand_activity: name, sub_activity: s });
    if (r.error) toast.error(r.error.message);
    else void loadExtra();
  }

  async function readPdf(file: File) {
    setReading(true);
    setLearned(null);
    try {
      const known = await brandErpCodes({ data: { brand: name } });
      if (!known.length)
        throw new Error(`No ${name} items in the ERP data yet. Import an ERP export first.`);
      const res = learnOrder(await pdfText(file), [...new Set(known)]);
      if (!res.order.length) throw new Error(`No ${name} item codes found in this PDF`);
      setLearned({ ...res, file: file.name });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setReading(false);
    }
  }
  async function saveOrder() {
    if (!learned) return;
    const me = (await looseDb.auth.getUser()).data.user?.id ?? null;
    const r = await looseDb.from("pdf_orders").upsert(
      {
        brand_activity: name,
        item_codes: learned.order,
        source_file: learned.file,
        updated_by: me,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_activity" },
    );
    if (r.error) toast.error(r.error.message);
    else {
      toast.success(`Saved the order of ${learned.order.length} codes`);
      setLearned(null);
      void loadExtra();
    }
  }

  const inBrand = (code: string) => b.entity_codes.includes(code);
  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-semibold">{name}</p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={b.active} onCheckedChange={(v) => setB({ ...b, active: v })} />
              Active
            </label>
            <Button size="sm" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}Save
            </Button>
          </div>
        </div>
        <div>
          <Label11>Sold in (entities users can pick)</Label11>
          <div className="mt-2 flex flex-wrap gap-4">
            {entities.map((e) => (
              <label key={e.code} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={inBrand(e.code)}
                  onCheckedChange={(v) =>
                    setB({
                      ...b,
                      entity_codes:
                        v === true
                          ? [...b.entity_codes, e.code]
                          : b.entity_codes.filter((x) => x !== e.code),
                    })
                  }
                />
                {e.code} · {e.name}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label11>Default max discount %</Label11>
            <Input
              className="mt-1"
              inputMode="decimal"
              value={b.default_max_discount ?? ""}
              onChange={(e) =>
                setB({
                  ...b,
                  default_max_discount: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label11>Default unit</Label11>
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={b.default_unit ?? ""}
              onChange={(e) => setB({ ...b, default_unit: e.target.value })}
            >
              <option value="" />
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label11>Logo (left of the PDF)</Label11>
            <div className="mt-1 flex items-center gap-3">
              <img
                src={b.logo_path || defaultBrandLogo(name)}
                alt=""
                className="h-9 max-w-40 rounded border bg-white object-contain p-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = "hidden";
                }}
              />
              <label className="cursor-pointer text-sm font-semibold text-primary">
                Upload
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setB({ ...b, logo_path: (await fileToLogo(f)).dataUrl });
                  }}
                />
              </label>
              {b.logo_path && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground"
                  onClick={() => setB({ ...b, logo_path: null })}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <div>
          <Label11>Supplier per entity</Label11>
          <div className="mt-2 grid gap-2">
            {entities
              .filter((e) => inBrand(e.code) || sup[e.code])
              .map((e) => (
                <div
                  key={e.code}
                  className="grid items-center gap-2 sm:grid-cols-[160px_180px_1fr]"
                >
                  <span className="text-sm">
                    {e.code} · {e.name}
                  </span>
                  <Input
                    className="h-8"
                    placeholder="Supplier code"
                    value={sup[e.code]?.supplier ?? ""}
                    onChange={(ev) =>
                      setSup({
                        ...sup,
                        [e.code]: {
                          supplier: ev.target.value,
                          supplier_name: sup[e.code]?.supplier_name ?? "",
                        },
                      })
                    }
                  />
                  <Input
                    className="h-8"
                    placeholder="Supplier name"
                    value={sup[e.code]?.supplier_name ?? ""}
                    onChange={(ev) =>
                      setSup({
                        ...sup,
                        [e.code]: {
                          supplier: sup[e.code]?.supplier ?? "",
                          supplier_name: ev.target.value,
                        },
                      })
                    }
                  />
                </div>
              ))}
            {!b.entity_codes.length && (
              <p className="text-xs text-muted-foreground">Tick the entities above first.</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-2">
        <Label11>Sub activities</Label11>
        <div className="flex flex-wrap gap-2">
          {subs.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
            >
              {s}
              <button type="button" title="Remove" onClick={() => void removeSub(s)}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {!subs.length && <span className="text-sm text-muted-foreground">None yet</span>}
        </div>
        <div className="flex max-w-md gap-2">
          <Input
            className="h-8"
            placeholder="Add a sub activity"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addSub();
            }}
          />
          <Button size="sm" variant="outline" onClick={addSub}>
            <Plus />
            Add
          </Button>
        </div>
      </Card>

      <Card className="space-y-2">
        <Label11>Pricing rules</Label11>
        <ListEditor
          table="pricing_rules"
          pk={["id"]}
          where={{ brand_activity: name }}
          order="entity_code"
          defaults={{
            method: "calculate",
            overhead_pct: 0,
            margin_divisors: [],
            round_to: 1,
            active: true,
          }}
          note="Retail = cost × exchange rate × (1 + overhead %) ÷ each divisor, rounded up. Leave Sub Activity empty for the whole brand. Confidential: only staff see this."
          cols={[
            {
              key: "entity_code",
              label: "Entity",
              type: "select",
              options: entities.map((e) => ({ value: e.code, label: `${e.code} · ${e.name}` })),
              required: true,
              width: "150px",
            },
            {
              key: "sub_activity",
              label: "Sub Activity",
              type: "select",
              options: subs.map((s) => ({ value: s, label: s })),
              placeholder: "All",
              width: "140px",
            },
            { key: "overhead_pct", label: "Overhead %", type: "number", width: "90px" },
            {
              key: "margin_divisors",
              label: "Divisors",
              type: "numlist",
              placeholder: "0.5",
              width: "110px",
            },
            {
              key: "round_to",
              label: "Round up to",
              type: "select",
              options: [
                { value: "1", label: "1" },
                { value: "10", label: "10" },
                { value: "100", label: "100" },
              ],
              width: "90px",
            },
            { key: "max_discount_pct", label: "Max discount %", type: "number", width: "100px" },
            { key: "active", label: "Active", type: "bool" },
          ]}
        />
      </Card>

      <Card className="space-y-3">
        <Label11>PDF item order</Label11>
        <p className="text-sm text-muted-foreground">
          {order
            ? `${order.item_codes.length} codes saved from ${order.source_file ?? "a PDF"}, ${fmtDate(order.updated_at)}.`
            : "No order saved. Upload an old pricelist PDF of this brand and the site learns the order of the codes."}{" "}
          New codes go next to similar codes.
        </p>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold",
            reading && "pointer-events-none opacity-60",
          )}
        >
          {reading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          Upload an old PDF
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readPdf(f);
              e.target.value = "";
            }}
          />
        </label>
        {learned && (
          <div className="space-y-2 rounded-lg bg-accent/60 p-3 text-sm">
            <p>
              <b>{learned.order.length} codes</b> found on {learned.pages} pages
              {learned.hiddenIgnored
                ? ` (${learned.hiddenIgnored} hidden old-text codes ignored)`
                : ""}
              .
            </p>
            {learned.notInErp.length > 0 && (
              <p className="text-warning">Not in the ERP data: {learned.notInErp.join(", ")}</p>
            )}
            <p className="text-muted-foreground">
              First: {learned.order.slice(0, 5).join(", ")} ... Last:{" "}
              {learned.order.slice(-3).join(", ")}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveOrder}>
                Save this order
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLearned(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
