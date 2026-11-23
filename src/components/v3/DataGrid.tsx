// DataGrid: an Excel-like grid for the Review and Approval pages and the Price check.
// Filter on every column (tick values, or a number range), sort, show/hide columns, search, frozen header and
// first columns, "Showing 12 of 59", double-click to edit, and smooth scrolling over thousands of rows.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Columns3, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface GridCol {
  key: string;
  label: string;
  type?: "text" | "number";
  width?: number;
  editable?: boolean;
  format?: (v: unknown, row: GridRow) => string;
  options?: { value: string; label: string }[]; // edit with a list instead of free text
}
export type GridRow = Record<string, unknown> & { _id: string };
type ColFilter = { values?: string[]; min?: number | undefined; max?: number | undefined };
export interface QuickFilter {
  key: string;
  label: string;
  test: (r: GridRow) => boolean;
  tone?: "warning" | "error" | "info";
}

const ROW_H = 34;
const show = (v: unknown) =>
  v === null || v === undefined
    ? ""
    : typeof v === "number"
      ? v.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : String(v);

export function DataGrid({
  columns,
  rows,
  height = 560,
  frozen = 2,
  cellClass,
  rowClass,
  onEdit,
  toolbar,
  quickFilters = [],
  hiddenByDefault = [],
}: {
  columns: GridCol[];
  rows: GridRow[];
  height?: number;
  frozen?: number;
  cellClass?: (row: GridRow, key: string) => string | undefined;
  rowClass?: (row: GridRow) => string | undefined;
  onEdit?: (row: GridRow, key: string, value: string) => Promise<void> | void;
  toolbar?: ReactNode;
  quickFilters?: QuickFilter[];
  hiddenByDefault?: string[];
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [filters, setFilters] = useState<Record<string, ColFilter>>({});
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(hiddenByDefault));
  const [quick, setQuick] = useState<string | null>(null);
  const [top, setTop] = useState(0);
  const [editing, setEditing] = useState<{ id: string; key: string; value: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const cols = columns.filter((c) => !hidden.has(c.key));
  const text = (r: GridRow, c: GridCol) => (c.format ? c.format(r[c.key], r) : show(r[c.key]));

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qf = quickFilters.find((f) => f.key === quick);
    let out = rows.filter((r) => {
      if (qf && !qf.test(r)) return false;
      for (const [k, f] of Object.entries(filters)) {
        const c = columns.find((x) => x.key === k);
        if (!c) continue;
        if (f.values) {
          if (!f.values.includes(text(r, c))) return false;
        }
        if (f.min !== undefined || f.max !== undefined) {
          const n = Number(r[k]);
          if (r[k] === null || r[k] === "" || !Number.isFinite(n)) return false;
          if (f.min !== undefined && n < f.min) return false;
          if (f.max !== undefined && n > f.max) return false;
        }
      }
      return !q || cols.some((c) => text(r, c).toLowerCase().includes(q));
    });
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      out = [...out].sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key];
        const r =
          c?.type === "number"
            ? Number(x ?? -Infinity) - Number(y ?? -Infinity)
            : show(x).localeCompare(show(y), undefined, { numeric: true });
        return sort.desc ? -r : r;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sort, filters, quick, columns, hidden]);

  const widths = cols.map((c) => c.width ?? (c.type === "number" ? 110 : 160));
  const left = widths.map((_, i) => widths.slice(0, i).reduce((a, b) => a + b, 0));
  const total = widths.reduce((a, b) => a + b, 0);
  const start = Math.max(0, Math.floor(top / ROW_H) - 10);
  const end = Math.min(view.length, start + Math.ceil(height / ROW_H) + 20);
  const activeFilters = Object.keys(filters).length + (quick ? 1 : 0) + (search ? 1 : 0);

  async function commit() {
    if (!editing || !onEdit) return;
    const row = rows.find((r) => r._id === editing.id);
    const e = editing;
    setEditing(null);
    if (row && show(row[e.key]) !== e.value) await onEdit(row, e.key, e.value);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-64">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="h-9 pl-9"
          />
        </div>
        {quickFilters.map((f) => {
          const n = rows.filter(f.test).length;
          return (
            <Button
              key={f.key}
              size="sm"
              variant={quick === f.key ? "default" : "outline"}
              onClick={() => setQuick(quick === f.key ? null : f.key)}
              className={cn(
                quick !== f.key &&
                  n > 0 &&
                  f.tone === "error" &&
                  "border-destructive/40 text-destructive",
                quick !== f.key &&
                  n > 0 &&
                  f.tone === "warning" &&
                  "border-warning/40 text-warning",
              )}
            >
              {f.label} · {n}
            </Button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Columns3 />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-96 overflow-auto">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={!hidden.has(c.key)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(v) =>
                  setHidden((h) => {
                    const n = new Set(h);
                    if (v) n.delete(c.key);
                    else n.add(c.key);
                    return n;
                  })
                }
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {activeFilters > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters({});
              setQuick(null);
              setSearch("");
            }}
          >
            <X />
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          Showing {view.length.toLocaleString()} of {rows.length.toLocaleString()}
        </span>
        {toolbar}
      </div>
      <div
        ref={scroller}
        onScroll={(e) => setTop(e.currentTarget.scrollTop)}
        className="relative overflow-auto rounded-[10px] border bg-card"
        style={{ height: Math.min(height, (view.length + 1) * ROW_H + 40) }}
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-[13px]"
          style={{ width: total }}
        >
          <colgroup>
            {widths.map((w, i) => (
              <col key={cols[i]!.key} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((c, i) => {
                const f = filters[c.key];
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "sticky top-0 z-20 h-10 border-b bg-muted px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground",
                      i < frozen && "z-30",
                      c.type === "number" && "text-right",
                    )}
                    style={i < frozen ? { left: left[i] } : undefined}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        c.type === "number" && "justify-end",
                      )}
                    >
                      <button
                        type="button"
                        className="truncate hover:text-foreground"
                        title={`Sort by ${c.label}`}
                        onClick={() =>
                          setSort((s) =>
                            s?.key === c.key
                              ? s.desc
                                ? null
                                : { key: c.key, desc: true }
                              : { key: c.key, desc: false },
                          )
                        }
                      >
                        {c.label}
                      </button>
                      {sort?.key === c.key &&
                        (sort.desc ? (
                          <ArrowDown className="size-3 shrink-0" />
                        ) : (
                          <ArrowUp className="size-3 shrink-0" />
                        ))}
                      <ColumnFilter
                        col={c}
                        rows={rows}
                        text={text}
                        value={f}
                        onChange={(v) =>
                          setFilters((all) => {
                            const n = { ...all };
                            if (v) n[c.key] = v;
                            else delete n[c.key];
                            return n;
                          })
                        }
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {start > 0 && (
              <tr style={{ height: start * ROW_H }}>
                <td colSpan={cols.length} />
              </tr>
            )}
            {view.slice(start, end).map((r) => (
              <tr key={r._id} className={cn("group", rowClass?.(r))} style={{ height: ROW_H }}>
                {cols.map((c, i) => {
                  const isEdit = editing?.id === r._id && editing.key === c.key;
                  const t = text(r, c);
                  return (
                    <td
                      key={c.key}
                      title={t}
                      onDoubleClick={() =>
                        c.editable &&
                        onEdit &&
                        setEditing({ id: r._id, key: c.key, value: show(r[c.key]) })
                      }
                      className={cn(
                        "truncate border-b bg-card px-2 group-hover:bg-muted/60",
                        i < frozen && "sticky z-10",
                        i === 0 && "font-semibold",
                        c.type === "number" && "text-right tabular-nums",
                        c.editable && onEdit && "cursor-cell",
                        rowClass?.(r),
                        cellClass?.(r, c.key),
                      )}
                      style={i < frozen ? { left: left[i] } : undefined}
                    >
                      {isEdit ? (
                        c.options ? (
                          <select
                            autoFocus
                            className="h-7 w-full rounded border bg-background px-1 text-[13px]"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onBlur={() => void commit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commit();
                              if (e.key === "Escape") setEditing(null);
                            }}
                          >
                            <option value="" />
                            {c.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            className="h-7 w-full rounded border bg-background px-1 text-[13px]"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onBlur={() => void commit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commit();
                              if (e.key === "Escape") setEditing(null);
                            }}
                          />
                        )
                      ) : (
                        t
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {end < view.length && (
              <tr style={{ height: (view.length - end) * ROW_H }}>
                <td colSpan={cols.length} />
              </tr>
            )}
          </tbody>
        </table>
        {view.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No rows match.</p>
        )}
      </div>
    </div>
  );
}

function ColumnFilter({
  col,
  rows,
  text,
  value,
  onChange,
}: {
  col: GridCol;
  rows: GridRow[];
  text: (r: GridRow, c: GridCol) => string;
  value: ColFilter | undefined;
  onChange: (v: ColFilter | null) => void;
}) {
  const [q, setQ] = useState("");
  const distinct = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const t = text(r, col);
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, col]);
  const picked = new Set(value?.values ?? distinct.map((d) => d[0]));
  const list = distinct
    .filter(([t]) => !q || t.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 300);
  const toggle = (t: string, on: boolean) => {
    const n = new Set(picked);
    if (on) n.add(t);
    else n.delete(t);
    onChange(
      n.size === distinct.length && !value?.min && !value?.max
        ? null
        : { ...value, values: [...n] },
    );
  };
  const active =
    !!value && (value.values !== undefined || value.min !== undefined || value.max !== undefined);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter ${col.label}`}
          className={cn(
            "shrink-0 rounded p-0.5 hover:bg-background",
            active ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          <Filter className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 normal-case tracking-normal" align="start">
        {col.type === "number" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              Greater or equal
              <Input
                type="number"
                className="mt-1 h-8"
                value={value?.min ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    min: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-xs">
              Less or equal
              <Input
                type="number"
                className="mt-1 h-8"
                value={value?.max ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    max: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        )}
        <Input
          placeholder="Search values"
          className="h-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="text-primary"
            onClick={() =>
              onChange(
                value?.min !== undefined || value?.max !== undefined
                  ? { min: value?.min, max: value?.max }
                  : null,
              )
            }
          >
            Select all
          </button>
          <button
            type="button"
            className="text-primary"
            onClick={() => onChange({ ...value, values: [] })}
          >
            Clear
          </button>
        </div>
        <div className="max-h-56 space-y-1 overflow-auto">
          {list.map(([t, n]) => (
            <label key={t} className="flex items-center gap-2 text-xs">
              <Checkbox checked={picked.has(t)} onCheckedChange={(v) => toggle(t, v === true)} />
              <span className="flex-1 truncate">{t || "(blank)"}</span>
              <span className="text-muted-foreground">{n}</span>
            </label>
          ))}
          {distinct.length > 300 && (
            <p className="text-xs text-muted-foreground">
              Type to search the other {distinct.length - 300} values.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
