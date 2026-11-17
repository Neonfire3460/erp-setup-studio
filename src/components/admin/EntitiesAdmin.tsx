import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type E = { code: string; name: string; region: string; currency: string; sort_order: number; _new?: boolean };

export function EntitiesAdmin() {
  const [rows, setRows] = useState<E[]>([]);
  async function load() {
    const { data, error } = await supabase.from("entities").select("*").order("sort_order");
    if (error) toast.error(error.message);
    else setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const set = (i: number, k: keyof E, v: string) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: k === "sort_order" ? Number(v) : v } : x)));

  async function save(e: E) {
    const { _new, ...row } = e;
    void _new;
    if (!row.code.trim()) { toast.error("Code is required"); return; }
    const { error } = await supabase.from("entities").upsert(row);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); load(); }
  }
  async function remove(e: E) {
    if (e._new) { setRows((r) => r.filter((x) => x !== e)); return; }
    if (!confirm(`Delete entity ${e.code}?`)) return;
    const { error } = await supabase.from("entities").delete().eq("code", e.code);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Region</TableHead>
            <TableHead>Currency</TableHead><TableHead>Sort</TableHead><TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e, i) => (
            <TableRow key={e._new ? `new-${i}` : e.code}>
              <TableCell><Input value={e.code} disabled={!e._new} onChange={(x) => set(i, "code", x.target.value)} className="w-20" /></TableCell>
              <TableCell><Input className="min-w-40" value={e.name} onChange={(x) => set(i, "name", x.target.value)} /></TableCell>
              <TableCell><Input className="min-w-40" value={e.region} onChange={(x) => set(i, "region", x.target.value)} /></TableCell>
              <TableCell><Input value={e.currency} onChange={(x) => set(i, "currency", x.target.value)} className="w-20" /></TableCell>
              <TableCell><Input type="number" value={e.sort_order} onChange={(x) => set(i, "sort_order", x.target.value)} className="w-20" /></TableCell>
              <TableCell className="space-x-2 whitespace-nowrap">
                <Button size="sm" onClick={() => save(e)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(e)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button variant="outline" onClick={() => setRows((r) => [...r, { code: "", name: "", region: "", currency: "", sort_order: r.length + 1, _new: true }])}>
        Add entity
      </Button>
    </div>
  );
}
