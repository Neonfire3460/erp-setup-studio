import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { catalogueOptions, readCatalogue, catalogueSchema } from "@/lib/catalogue.functions";
import { downloadBlob } from "@/lib/workflow";
import { BrandPicker } from "./BrandPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export const catalogueOptionsQuery = queryOptions({
  queryKey: ["catalogue-options"],
  queryFn: () => catalogueOptions(),
});
const columns = [
  ["item_code", "Item Code"],
  ["alternative_code", "Alternative Code"],
  ["description", "Description"],
  ["alternate_description", "Alternate Description"],
  ["retail_price", "Retail Price"],
  ["family_name", "Family"],
  ["group_name", "Group"],
  ["category_name", "Category"],
  ["sub_category_name", "Sub Category"],
  ["midwich_family_name", "Midwich Family"],
] as const;
const filterFields = [
  ["sub_activity", "Sub Activity"],
  ["family_name", "Family"],
  ["group_name", "Group"],
  ["category_name", "Category"],
  ["sub_category_name", "Sub Category"],
  ["midwich_family_name", "Midwich Family"],
] as const;
export function CataloguePage() {
  const { data: opts } = useSuspenseQuery(catalogueOptionsQuery);
  const [state, setState] = useState(catalogueSchema.parse({}));
  const [blob, setBlob] = useState<Blob | null>(null);
  const read = useServerFn(readCatalogue);
  const [busy, setBusy] = useState(false);
  const brands = [
    ...new Set(
      opts.items
        .filter((i) => i.entity_code === state.entity)
        .map((i) => i.brand_activity)
        .filter((b): b is string => Boolean(b)),
    ),
  ];
  const selected = opts.items.filter(
    (i) => i.entity_code === state.entity && i.brand_activity === state.brand,
  );
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["catalogue", state], queryFn: () => readCatalogue({ data: state }) }),
  );
  function change(p: Partial<typeof state>) {
    setBlob(null);
    setState((s) => ({ ...s, page: 0, ...p }));
  }
  async function prepare() {
    setBusy(true);
    try {
      const r = await read({ data: { ...state, download: true } });
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Catalogue");
      ws.addRow(columns.map((c) => c[1]));
      r.rows.forEach((row) => {
        ws.addRow(columns.map(([k]) => row[k]));
      });
      ws.getColumn(1).numFmt = "@";
      setBlob(new Blob([await wb.xlsx.writeBuffer()]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare Excel");
    } finally {
      setBusy(false);
    }
  }
  const last = selected
    .map((i) => i.approved_at ?? "")
    .sort()
    .at(-1);
  return (
    <div className="space-y-6">
      <h1 className="nmk-page-heading">Catalogue</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Entity</Label>
          <Select
            value={state.entity}
            onValueChange={(v) => change({ entity: v, brand: "", filters: {} })}
          >
            <SelectTrigger className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.entities.map((e) => (
                <SelectItem key={e.code} value={e.code}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Brand</Label>
          <BrandPicker
            value={state.brand}
            brands={brands}
            onChange={(v) => change({ brand: v, filters: {} })}
          />
        </div>
      </div>
      {state.brand && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {filterFields.map(([field, label]) => (
              <div key={field} className="space-y-1">
                <Label>{label}</Label>
                <Select
                  value={state.filters[field] || "__all__"}
                  onValueChange={(v) =>
                    change({ filters: { ...state.filters, [field]: v === "__all__" ? "" : v } })
                  }
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    {[
                      ...new Set(
                        selected.map((i) => i[field]).filter((v): v is string => Boolean(v)),
                      ),
                    ]
                      .sort()
                      .map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label="Search catalogue"
              placeholder="Search code or description"
              className="w-full bg-card sm:w-80"
              value={state.search}
              onChange={(e) => change({ search: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              {data.count} items
              {last ? ` · Last approval ${new Date(last).toLocaleDateString()}` : ""}
            </p>
            {blob ? (
              <Button
                variant="outline"
                onClick={() => downloadBlob(blob, `Catalogue_${state.entity}_${state.brand}.xlsx`)}
              >
                <Download />
                Download as Excel
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => void prepare()}>
                Prepare Excel
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(([k, label]) => (
                  <TableHead key={k}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        change({ sort: k, desc: state.sort === k ? !state.desc : false })
                      }
                    >
                      {label}
                      {k === "retail_price"
                        ? ` ${opts.entities.find((e) => e.code === state.entity)?.currency ?? ""}`
                        : ""}
                      <ArrowUpDown className="size-3" />
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.item_code}>
                  {columns.map(([k]) => (
                    <TableCell
                      key={k}
                      className={
                        k === "retail_price"
                          ? "text-right"
                          : k === "item_code"
                            ? "font-semibold"
                            : ""
                      }
                    >
                      {r[k] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!data.rows.length && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No approved items match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={!state.page}
              onClick={() => setState((s) => ({ ...s, page: s.page - 1 }))}
            >
              Previous
            </Button>
            <span className="self-center text-sm">Page {state.page + 1}</span>
            <Button
              variant="outline"
              disabled={(state.page + 1) * 100 >= data.count}
              onClick={() => setState((s) => ({ ...s, page: s.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </>
      )}
      {!state.brand && (
        <p className="py-12 text-center text-muted-foreground">
          {brands.length ? "Choose a brand." : "No approved items for this entity."}
        </p>
      )}
    </div>
  );
}
