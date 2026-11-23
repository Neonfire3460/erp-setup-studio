// B PDF Pricelist: pick a brand and an entity, check the list, make the PDF in NMK's layout (gaps 21-24).
// Items come from the ERP data, prices from the latest approved ticket, order from the learned brand order.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileDown, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BrandCombo } from "@/components/v3/BrandCombo";
import {
  Card,
  Empty,
  Label11,
  PageHeader,
  Stat,
  errText,
  fmtDate,
  fmtNum,
} from "@/components/v3/ui";
import { headFor, downloadBlob } from "@/lib/v3/page";
import { defaultBrandLogo, defaultEntityLogo, loadLogo } from "@/lib/v3/logo";
import { buildPricelistPdf, pricelistFileName } from "@/lib/nmk/pricelistPdf";
import { pdfItems, pdfOptions, recordPdf } from "@/lib/v3/pdf.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pdf-pricelist")({
  head: () => headFor("PDF Pricelist", "Make a brand pricelist PDF for an entity."),
  component: Page,
});

type Data = Awaited<ReturnType<typeof pdfItems>>;
type Row = Data["items"][number] & { fixDesc?: string; fixRetail?: string };
const PLACED: Record<string, string> = {
  template: "",
  best_fit: "placed next to similar codes",
  category_end: "end of its category",
  end: "end of the list",
};

function Page() {
  const qc = useQueryClient();
  const opts = useQuery({ queryKey: ["pdf-options"], queryFn: () => pdfOptions() });
  const [brand, setBrand] = useState("");
  const [entity, setEntity] = useState("");
  const [inactive, setInactive] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [making, setMaking] = useState(false);

  async function load(b = brand, e = entity, inc = inactive) {
    if (!b || !e) return;
    setLoading(true);
    setData(null);
    try {
      const d = await pdfItems({ data: { brand: b, entityCode: e, includeInactive: inc } });
      setData(d);
      setRows(d.items);
      setTitle(d.title);
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setLoading(false);
    }
  }

  const fixed = (r: Row) => ({
    desc: (r.fixDesc ?? r.description).trim(),
    retail: r.fixRetail !== undefined && r.fixRetail !== "" ? Number(r.fixRetail) : r.retail,
  });
  const problems = rows.filter((r) => {
    const f = fixed(r);
    return !f.desc || f.retail === null || !(Number(f.retail) > 0);
  });
  const printable = rows.filter((r) => !problems.includes(r));
  const set = (code: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.itemCode === code ? { ...r, ...patch } : r)));

  async function make() {
    if (!data) return;
    setMaking(true);
    try {
      const [{ jsPDF }, { autoTable }, brandLogo, entityLogo] = await Promise.all([
        import("jspdf/dist/jspdf.es.min.js"),
        import("jspdf-autotable"),
        loadLogo(data.brand.logoPath, defaultBrandLogo(data.brand.name)),
        loadLogo(data.entity.logoPath, defaultEntityLogo(data.entity.code)),
      ]);
      if (!brandLogo)
        toast.warning(
          `No ${data.brand.name} logo yet. An admin adds it in Admin settings → Brands.`,
        );
      if (!entityLogo)
        toast.warning(
          `No logo for ${data.entity.name}. An admin adds it in Admin settings → Entities.`,
        );
      const doc = buildPricelistPdf(jsPDF, autoTable, {
        title: title.trim() || data.title,
        currency: data.entity.currency,
        termsLine: data.entity.termsLine,
        noticeLine: data.noticeLine,
        confidentialLine: data.confidentialLine,
        legalName: data.entity.legalName,
        brandLogo,
        entityLogo,
        items: printable.map((r) => {
          const f = fixed(r);
          return { itemCode: r.itemCode, description: f.desc, retail: Number(f.retail) };
        }),
      });
      downloadBlob(
        doc.output("blob") as Blob,
        pricelistFileName(
          data.brand.name,
          title.trim() || data.title,
          data.entity.name,
          data.entity.currency,
        ),
      );
      await recordPdf({
        data: {
          brand: data.brand.name,
          entityCode: data.entity.code,
          title: title.trim() || data.title,
          itemCount: printable.length,
        },
      });
      void qc.invalidateQueries({ queryKey: ["pdf-options"] });
      toast.success(`PDF made with ${printable.length} items`);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setMaking(false);
    }
  }

  const o = opts.data;
  const brandInfo = o?.brands.find((b) => b.brand === brand);
  return (
    <div className="space-y-6">
      <PageHeader
        title="PDF Pricelist"
        description="Pick a brand and an entity. Prices are the latest approved retail prices, else the ERP's. Inactive items are left out unless you include them."
      />
      {opts.error && <p className="text-sm text-destructive">{errText(opts.error)}</p>}
      <Card className="space-y-4">
        <div>
          <Label11>Brand</Label11>
          <div className="mt-1">
            <BrandCombo
              brands={(o?.brands ?? []).map((b) => b.brand)}
              value={brand}
              onChange={(b) => {
                setBrand(b);
                void load(b);
              }}
            />
          </div>
        </div>
        {brand && (
          <div className="space-y-2">
            <Label11>Entity</Label11>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(o?.entities ?? []).map((e) => {
                const sold = !brandInfo?.entities.length || brandInfo.entities.includes(e.code);
                return (
                  <button
                    key={e.code}
                    type="button"
                    disabled={!e.pdf_allowed}
                    onClick={() => {
                      setEntity(e.code);
                      void load(brand, e.code);
                    }}
                    className={cn(
                      "rounded-lg border p-3 text-left text-sm transition",
                      entity === e.code ? "border-primary bg-accent" : "hover:bg-muted/60",
                      !e.pdf_allowed && "cursor-not-allowed opacity-45",
                    )}
                  >
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.code} · {e.currency}
                      {!e.pdf_allowed
                        ? " · no PDF template yet"
                        : !sold
                          ? " · brand not set here"
                          : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {brand && entity && (
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-72">
              <Label11>Title</Label11>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch
                checked={inactive}
                onCheckedChange={(v) => {
                  setInactive(v);
                  void load(brand, entity, v);
                }}
              />
              Include inactive items
            </label>
          </div>
        )}
      </Card>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading items...
        </p>
      )}
      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Items in the PDF" value={printable.length} />
            <Stat
              label="Need a fix"
              value={problems.length}
              tone={problems.length ? "warning" : undefined}
            />
            <Stat label="Inactive left out" value={data.inactiveLeftOut} />
            <Stat label="New places" value={rows.filter((r) => r.placedBy !== "template").length} />
          </div>
          {!data.hasOrder && (
            <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
              No item order is saved for {data.brand.name} yet, so items are in category order. An
              admin can teach the order from an old PDF in Admin settings → Brands.
            </p>
          )}
          {problems.length > 0 && (
            <Card className="space-y-2 border-warning/40">
              <p className="flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="size-4" />
                {problems.length} item{problems.length === 1 ? "" : "s"} would print badly. Fix them
                here or they're left out.
              </p>
              <div className="max-h-72 space-y-1 overflow-auto">
                {problems.map((r) => (
                  <div
                    key={r.itemCode}
                    className="grid items-center gap-2 text-sm sm:grid-cols-[180px_1fr_140px]"
                  >
                    <span className="font-semibold">{r.itemCode}</span>
                    <Input
                      className="h-8"
                      placeholder="Description"
                      value={r.fixDesc ?? r.description}
                      onChange={(e) => set(r.itemCode, { fixDesc: e.target.value })}
                    />
                    <Input
                      className="h-8"
                      placeholder="List price"
                      inputMode="decimal"
                      value={r.fixRetail ?? (r.retail ?? "").toString()}
                      onChange={(e) => set(r.itemCode, { fixRetail: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Fixes here only change this PDF. To fix the ERP, send a ticket.
              </p>
            </Card>
          )}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label11>Preview ({rows.length} items)</Label11>
              <Button disabled={making || !printable.length} onClick={make}>
                {making ? <Loader2 className="animate-spin" /> : <FileDown />}Make PDF
              </Button>
            </div>
            <div className="max-h-[560px] overflow-auto rounded-lg border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-[#13bbb3] text-left font-semibold text-black">
                  <tr>
                    <th className="p-2">Item Code</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">List Price</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const bad = problems.includes(r);
                    const f = fixed(r);
                    return (
                      <tr
                        key={r.itemCode}
                        className={cn(
                          "border-t",
                          bad && "bg-warning-soft/60 text-muted-foreground line-through",
                        )}
                      >
                        <td className="whitespace-nowrap p-2">{r.itemCode}</td>
                        <td className="p-2">{f.desc}</td>
                        <td className="p-2 text-right tabular-nums">
                          {f.retail === null ? "" : fmtNum(Number(f.retail))}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {[
                            PLACED[r.placedBy],
                            r.priceFrom === "erp"
                              ? "ERP price"
                              : r.priceFrom === "none"
                                ? "no price"
                                : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {!brand && !opts.isLoading && <Empty icon={FileText} text="Pick a brand to start." />}

      {!!o?.history.length && (
        <Card className="space-y-2">
          <Label11>Recent PDFs</Label11>
          <ul className="space-y-1 text-sm">
            {o.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>
                  {h.brand_activity} · {h.entity_code} · {h.title} · {h.item_count} items
                </span>
                <span className="text-muted-foreground">{fmtDate(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
