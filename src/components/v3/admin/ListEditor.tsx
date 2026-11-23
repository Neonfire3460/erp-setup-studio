// A small spreadsheet-like editor for the simple settings tables (entities, currencies, rates, units, rules...).
// Staff edit these in the browser: RLS "staff write" protects them, and every change goes to the change log.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog, errText } from "@/components/v3/ui";
import { fileToLogo } from "@/lib/v3/logo";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const looseDb = supabase as any;
export type Row = Record<string, unknown>;
export type Col = {
  key: string;
  label: string;
  type?: "text" | "number" | "bool" | "select" | "numlist" | "logo";
  options?: { value: string; label: string }[];
  width?: string;
  lockOnEdit?: boolean;
  required?: boolean;
  placeholder?: string;
  fallback?: (row: Row) => string | null; // logo shown when the row has none
};

export async function loadAll(table: string, where: Row = {}, order?: string) {
  const out: Row[] = [];
  for (let a = 0; ; a += 1000) {
    let q = looseDb.from(table).select("*").match(where);
    if (order) q = q.order(order);
    const r = await q.range(a, a + 999);
    if (r.error) throw new Error(r.error.message);
    out.push(...r.data);
    if (r.data.length < 1000) return out;
  }
}

const keyOf = (pk: string[], r: Row) => pk.map((k) => String(r[k] ?? "")).join("|");

function toDb(c: Col, v: unknown) {
  if (c.type === "number") return v === "" || v === null || v === undefined ? null : Number(v);
  if (c.type === "numlist")
    return Array.isArray(v)
      ? v
      : String(v ?? "")
          .split(/[,\s]+/)
          .filter(Boolean)
          .map(Number);
  if (c.type === "text" || c.type === "select" || !c.type)
    return typeof v === "string" ? v.trim() : v;
  return v;
}

export function ListEditor({
  table,
  pk,
  cols,
  where = {},
  order,
  defaults = {},
  note,
  searchable,
  canDelete = true,
  canAdd = true,
  filterRows,
  onSaved,
}: {
  table: string;
  pk: string[];
  cols: Col[];
  where?: Row;
  order?: string;
  defaults?: Row;
  note?: string;
  searchable?: boolean;
  canDelete?: boolean;
  canAdd?: boolean;
  filterRows?: ((r: Row) => boolean) | undefined;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const [added, setAdded] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Row | null>(null);
  const whereKey = JSON.stringify(where);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await loadAll(table, JSON.parse(whereKey) as Row, order));
      setEdits({});
      setAdded([]);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, [table, whereKey, order]);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = filterRows ? rows.filter(filterRows) : rows;
    return s
      ? base.filter((r) =>
          cols.some((c) =>
            String(r[c.key] ?? "")
              .toLowerCase()
              .includes(s),
          ),
        )
      : base;
  }, [rows, q, cols, filterRows]);
  const dirty = Object.keys(edits).length + added.length;

  async function save() {
    for (const r of added)
      for (const c of cols)
        if (c.required && (r[c.key] === "" || r[c.key] === null || r[c.key] === undefined)) {
          toast.error(`${c.label} is required`);
          return;
        }
    setSaving(true);
    try {
      for (const [k, patch] of Object.entries(edits)) {
        const row = rows.find((r) => keyOf(pk, r) === k);
        if (!row) continue;
        const body = Object.fromEntries(
          Object.entries(patch).map(([key, v]) => [
            key,
            toDb(
              cols.find((c) => c.key === key)!,
              v,
            ),
          ]),
        );
        const r = await looseDb
          .from(table)
          .update(body)
          .match(Object.fromEntries(pk.map((p) => [p, row[p]])));
        if (r.error) throw new Error(`${keyOf(pk, row)}: ${r.error.message}`);
      }
      if (added.length) {
        const body = added.map((a) => ({
          ...defaults,
          ...where,
          ...Object.fromEntries(
            cols.filter((c) => a[c.key] !== undefined).map((c) => [c.key, toDb(c, a[c.key])]),
          ),
        }));
        const r = await looseDb.from(table).insert(body);
        if (r.error) throw new Error(r.error.message);
      }
      toast.success("Saved");
      onSaved?.();
      await load();
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setSaving(false);
    }
  }

  const cell = (c: Col, row: Row, value: unknown, set: (v: unknown) => void, isNew: boolean) => {
    const locked = c.lockOnEdit && !isNew;
    if (c.type === "bool") return <Switch checked={!!value} onCheckedChange={set} />;
    if (c.type === "select")
      return (
        <select
          disabled={locked}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-[13px] disabled:opacity-60"
          value={String(value ?? "")}
          onChange={(e) => set(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">{c.placeholder ?? ""}</option>
          {c.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    if (c.type === "logo") {
      const src = (value as string | null) || c.fallback?.(row) || null;
      return (
        <div className="flex items-center gap-2">
          {src ? (
            <img
              src={src}
              alt=""
              className="h-8 max-w-28 rounded border bg-white object-contain p-0.5"
            />
          ) : (
            <span className="text-xs text-muted-foreground">none</span>
          )}
          <label className="cursor-pointer text-xs font-semibold text-primary">
            <Upload className="inline size-3.5" /> {value ? "Change" : "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  try {
                    set((await fileToLogo(f)).dataUrl);
                  } catch (err) {
                    toast.error(errText(err));
                  }
                }
              }}
            />
          </label>
        </div>
      );
    }
    const v = c.type === "numlist" && Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return (
      <Input
        disabled={locked}
        className={cn("h-8 text-[13px]", c.type === "number" && "text-right tabular-nums")}
        inputMode={c.type === "number" || c.type === "numlist" ? "decimal" : undefined}
        placeholder={c.placeholder}
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    );
  };

  return (
    <div className="space-y-3">
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <div className="relative w-64">
            <Search className="absolute left-2 top-2 size-4 text-muted-foreground" />
            <Input
              className="h-8 pl-8"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
        {canAdd && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdded((a) => [...a, { ...defaults }])}
          >
            <Plus />
            Add row
          </Button>
        )}
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}Save{dirty ? ` (${dirty})` : ""}
        </Button>
        {dirty > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEdits({});
              setAdded([]);
            }}
          >
            Undo changes
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? "Loading..." : `${shown.length} of ${rows.length}`}
        </span>
      </div>
      <div className="max-h-[560px] overflow-auto rounded-lg border">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap border-b p-2"
                  style={c.width ? { minWidth: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
              {canDelete && <th className="border-b p-2" />}
            </tr>
          </thead>
          <tbody>
            {added.map((a, i) => (
              <tr key={`new-${i}`} className="bg-accent/40">
                {cols.map((c) => (
                  <td key={c.key} className="border-b p-1.5">
                    {cell(
                      c,
                      a,
                      a[c.key],
                      (v) =>
                        setAdded((list) =>
                          list.map((x, j) => (j === i ? { ...x, [c.key]: v } : x)),
                        ),
                      true,
                    )}
                  </td>
                ))}
                <td className="border-b p-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setAdded((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
            {shown.slice(0, 500).map((r) => {
              const k = keyOf(pk, r);
              const e = edits[k] ?? {};
              return (
                <tr key={k} className={cn(Object.keys(e).length > 0 && "bg-warning-soft/40")}>
                  {cols.map((c) => (
                    <td key={c.key} className="border-b p-1.5">
                      {cell(
                        c,
                        r,
                        c.key in e ? e[c.key] : r[c.key],
                        (v) => setEdits((all) => ({ ...all, [k]: { ...all[k], [c.key]: v } })),
                        false,
                      )}
                    </td>
                  ))}
                  {canDelete && (
                    <td className="border-b p-1.5">
                      <Button size="icon" variant="ghost" title="Delete" onClick={() => setDel(r)}>
                        <Trash2 />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length > 500 && (
          <p className="p-2 text-xs text-muted-foreground">
            Showing the first 500. Search to find others.
          </p>
        )}
      </div>
      <ConfirmDialog
        open={!!del}
        title="Delete this row?"
        description={del ? pk.map((p) => String(del[p])).join(" · ") : ""}
        confirm="Delete"
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return;
          const r = await looseDb
            .from(table)
            .delete()
            .match(Object.fromEntries(pk.map((p) => [p, del[p]])));
          if (r.error) toast.error(r.error.message);
          else {
            toast.success("Deleted");
            setDel(null);
            onSaved?.();
            await load();
          }
        }}
      />
    </div>
  );
}
