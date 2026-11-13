import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type B = { brand_activity: string; supplier: string; default_unit: string | null; _new?: boolean };

export function BrandsAdmin() {
  const [rows, setRows] = useState<B[]>([]);
  async function load() {
    const { data, error } = await supabase.from("brands").select("*").order("brand_activity");
    if (error) toast.error(error.message);
    else setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const set = (i: number, k: keyof B, v: string) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function save(b: B) {
    if (!b.brand_activity.trim()) { toast.error("Brand Activity is required"); return; }
    const { error } = await supabase.from("brands").upsert({
      brand_activity: b.brand_activity.trim(),
      supplier: b.supplier.trim() || "TO SET",
      default_unit: b.default_unit?.trim() || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Saved"); load(); }
  }
  async function remove(b: B) {
    if (b._new) { setRows((r) => r.filter((x) => x !== b)); return; }
    if (!confirm(`Delete brand ${b.brand_activity}?`)) return;
    const { error } = await supabase.from("brands").delete().eq("brand_activity", b.brand_activity);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Brand Activity</TableHead><TableHead>Supplier</TableHead><TableHead>Default unit</TableHead><TableHead /></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b, i) => (
            <TableRow key={b._new ? `new-${i}` : b.brand_activity}>
              <TableCell><Input value={b.brand_activity} disabled={!b._new} onChange={(x) => set(i, "brand_activity", x.target.value)} /></TableCell>
              <TableCell><Input value={b.supplier} onChange={(x) => set(i, "supplier", x.target.value)} /></TableCell>
              <TableCell><Input value={b.default_unit ?? ""} onChange={(x) => set(i, "default_unit", x.target.value)} /></TableCell>
              <TableCell className="space-x-2 whitespace-nowrap">
                <Button size="sm" onClick={() => save(b)}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => remove(b)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button variant="outline" onClick={() => setRows((r) => [...r, { brand_activity: "", supplier: "TO SET", default_unit: null, _new: true }])}>
        Add brand
      </Button>
    </div>
  );
}
