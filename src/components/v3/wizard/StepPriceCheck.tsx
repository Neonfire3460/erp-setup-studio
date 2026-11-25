// Step 3: Price check. New cost vs ERP cost, bands, top 10s, full table, new codes and description changes.
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataGrid, type GridRow } from "@/components/v3/DataGrid";
import { Card, Label11, Stat, errText, fmtNum, fmtPct } from "@/components/v3/ui";
import { priceCheck } from "@/lib/v3/wizard.functions";
import { codeKey } from "@/lib/nmk/util";
import type { TicketDraft, TicketLine } from "@/lib/nmk/types";
import { brandOf, type PriceCheckData, type StepProps } from "./shared";
import { DescriptionPicker } from "./DescriptionPicker";

type EntityCheck = PriceCheckData["result"]["perEntity"][number];

export function StepPriceCheck(
  props: StepProps & { pc: PriceCheckData | null; setPc: (p: PriceCheckData) => void },
) {
  const { draft, setDraft, next, back, busy, pc, setPc, opts } = props;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    priceCheck({ data: { draft: draft as never } })
      .then(setPc)
      .catch((e) => toast.error(errText(e)))
      .finally(() => setLoading(false));
    // Run once when the step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !pc)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Comparing with the ERP...
      </div>
    );
  const r = pc.result;
  function proceed() {
    const brand = brandOf(opts, draft.brand);
    const newSet = new Set(r.newCodes.map((n) => n.lineNo));
    const erpDesc = new Map(r.descriptionDiffs.map((x) => [codeKey(x.itemCode), x.erpDescription]));
    const lines: TicketLine[] = draft.lines.map((l) => {
      const isNew = newSet.has(l.lineNo);
      const desc = erpDesc.get(codeKey(l.itemCode));
      const base: TicketLine = {
        ...l,
        isNew,
        include: isNew ? l.include : true,
        ...(desc ? { erpDescription: desc } : {}),
      };
      if (!isNew) return { ...base, useVendorDescription: !!desc && l.useVendorDescription };
      return base.newItem
        ? base
        : {
            ...base,
            useVendorDescription: false,
            newItem: {
              altCode: l.altCode || l.itemCode,
              altDescription: l.altDescription || l.description,
              familyCode: "",
              groupCode: "",
              subCategoryCode: "",
              unitCode: brand?.default_unit ?? "",
              subActivity: brand?.sub_activities.length === 1 ? brand.sub_activities[0]! : "",
              inactive: 0,
              showOnWeb: null,
              showPrices: null,
            },
          };
    });
    const d: TicketDraft = { ...draft, lines };
    void next(d);
  }

  const main = r.perEntity[0];
  return (
    <div className="space-y-5">
      {r.perEntity.length > 1 ? (
        <Tabs defaultValue={r.perEntity[0]!.entityCode + r.perEntity[0]!.costCurrency}>
          <TabsList>
            {r.perEntity.map((e) => (
              <TabsTrigger
                key={e.entityCode + e.costCurrency}
                value={e.entityCode + e.costCurrency}
              >
                {e.entityCode} · {e.costCurrency}
              </TabsTrigger>
            ))}
          </TabsList>
          {r.perEntity.map((e) => (
            <TabsContent key={e.entityCode + e.costCurrency} value={e.entityCode + e.costCurrency}>
              <EntityPanel e={e} newCodes={r.newCodes.length} warnPct={r.warnPct} />
            </TabsContent>
          ))}
        </Tabs>
      ) : main ? (
        <EntityPanel e={main} newCodes={r.newCodes.length} warnPct={r.warnPct} />
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            No ERP data for this brand in {r.masterEntity} yet, so every code is new.
          </p>
        </Card>
      )}

      {r.newCodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-primary/30 bg-accent p-4">
          <PackagePlus className="size-5 text-primary" />
          <p className="text-sm">
            <b>
              {r.newCodes.length} new item code{r.newCodes.length === 1 ? "" : "s"}
            </b>{" "}
            need registering. You fill their details in the next step.
          </p>
        </div>
      )}

      {r.descriptionDiffs.length > 0 && (
        <DescriptionPicker diffs={r.descriptionDiffs} draft={draft} setDraft={setDraft} />
      )}

      {r.missing.length > 0 && (
        <Collapsible className="rounded-[10px] border bg-card p-4">
          <CollapsibleTrigger className="text-sm font-semibold text-primary">
            In the ERP but not in this list: {r.missing.length} (possibly discontinued, for
            information)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 max-h-72 space-y-1 overflow-auto text-sm">
            {r.missing.map((m) => (
              <p key={m.itemCode}>
                <b>{m.itemCode}</b> <span className="text-muted-foreground">{m.description}</span>
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
        <Button disabled={busy} onClick={proceed}>
          {r.newCodes.length ? "Continue to New items" : "Continue to Suppliers"}
        </Button>
      </div>
    </div>
  );
}

function EntityPanel({
  e,
  newCodes,
  warnPct,
}: {
  e: EntityCheck;
  newCodes: number;
  warnPct: number;
}) {
  const t = e.tiles;
  const maxBand = Math.max(1, ...e.bands.map((b) => b.count));
  const rows: GridRow[] = e.rows.map((x) => ({
    _id: x.itemCode,
    ...x,
    check: x.check ? "Check" : "",
  }));
  return (
    <div className="space-y-4">
      {e.currencyWarning && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="size-4" />
          {e.currencyWarning}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Stat label="Compared" value={t.compared} />
        <Stat label="Went up" value={t.up} />
        <Stat label="Went down" value={t.down} />
        <Stat label="Unchanged" value={t.unchanged} />
        <Stat label="New codes" value={newCodes} />
        <Stat label="Average" value={fmtPct(t.avgPct) || "-"} />
        <Stat label="Median" value={fmtPct(t.medianPct) || "-"} />
      </div>
      <Card className="space-y-2">
        <Label11>
          How many items moved by how much (ERP {e.entityCode}, cost in {e.costCurrency})
        </Label11>
        {e.bands.map((b) => (
          <div key={b.label} className="grid grid-cols-[120px_1fr_40px] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{b.label}</span>
            <div className="h-5 rounded bg-muted">
              <div
                className={
                  b.label.startsWith("−")
                    ? "h-5 rounded bg-brand-cyan"
                    : b.label === "0%"
                      ? "h-5 rounded bg-muted-foreground/40"
                      : "h-5 rounded bg-primary"
                }
                style={{ width: `${(b.count / maxBand) * 100}%` }}
              />
            </div>
            <span className="text-right tabular-nums">{b.count}</span>
          </div>
        ))}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable title="Top 10 increases" rows={e.topUp} />
        <TopTable title="Top 10 decreases" rows={e.topDown} />
      </div>
      <DataGrid
        frozen={1}
        height={420}
        rows={rows}
        columns={[
          { key: "itemCode", label: "Item Code", width: 170 },
          { key: "description", label: "Description", width: 320 },
          { key: "oldCost", label: `Old cost (${e.costCurrency})`, type: "number", width: 130 },
          { key: "newCost", label: `New cost (${e.costCurrency})`, type: "number", width: 130 },
          { key: "change", label: "Change", type: "number", width: 110 },
          {
            key: "pct",
            label: "% change",
            type: "number",
            width: 110,
            format: (v) => fmtPct(v as number | null),
          },
          { key: "check", label: `Over ±${warnPct}%`, width: 110 },
        ]}
        cellClass={(r, k) =>
          k === "check" && r["check"] ? "text-warning font-semibold" : undefined
        }
        quickFilters={[
          { key: "check", label: "Check", tone: "warning", test: (r) => !!r["check"] },
        ]}
      />
    </div>
  );
}

function TopTable({ title, rows }: { title: string; rows: EntityCheck["topUp"] }) {
  return (
    <Card className="space-y-2">
      <Label11>{title}</Label11>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead className="text-right">Old</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((x) => (
              <TableRow key={x.itemCode}>
                <TableCell className="font-semibold">{x.itemCode}</TableCell>
                <TableCell className="text-right">{fmtNum(x.oldCost)}</TableCell>
                <TableCell className="text-right">{fmtNum(x.newCost)}</TableCell>
                <TableCell
                  className={x.check ? "text-right font-semibold text-warning" : "text-right"}
                >
                  {fmtPct(x.pct)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">None.</p>
      )}
    </Card>
  );
}
