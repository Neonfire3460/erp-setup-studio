import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type B = { brand_activity: string; default_unit: string | null; suppliers: Record<string, string>; _new?: boolean };

export function BrandsAdmin() {
  const [rows, setRows] = useState<B[]>([]);
  const [entities, setEntities] = useState<{ code: string; name: string }[]>([]);
  async function load() {
    const [brands, suppliers, entities] = await Promise.all([
      supabase.from("brands").select("brand_activity,default_unit").order("brand_activity"),
      supabase.from("brand_suppliers").select("*"),
      supabase.from("entities").select("code,name").order("sort_order"),
    ]);
    const error = brands.error || suppliers.error || entities.error;
    if (error) toast.error(error.message);
    else {
      setEntities(entities.data ?? []);
      setRows((brands.data ?? []).map(b => ({ ...b, suppliers: Object.fromEntries((suppliers.data ?? []).filter(s => s.brand_activity === b.brand_activity).map(s => [s.entity_code, s.supplier])) })));
    }
  }
  useEffect(() => { load(); }, []);

  const set = (i: number, k: "brand_activity" | "default_unit", v: string) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function save(b: B) {
    if (!b.brand_activity.trim()) { toast.error("Brand Activity is required"); return; }
    const { error } = await supabase.from("brands").upsert({
      brand_activity: b.brand_activity.trim(),
      default_unit: b.default_unit?.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    const codes = entities.map(e => ({ brand_activity: b.brand_activity.trim(), entity_code: e.code, supplier: b.suppliers[e.code]?.trim() || "TO SET" }));
    if (codes.length) {
      const saved = await supabase.from("brand_suppliers").upsert(codes);
      if (saved.error) { toast.error(saved.error.message); return; }
    }
    toast.success("Saved"); load();
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
          <TableRow><TableHead>Brand Activity</TableHead><TableHead>Default unit</TableHead>{entities.map(e => <TableHead key={e.code}>Supplier {e.code}</TableHead>)}<TableHead /></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b, i) => (
            <TableRow key={b._new ? `new-${i}` : b.brand_activity}>
              <TableCell><Input className="min-w-36" value={b.brand_activity} disabled={!b._new} onChange={(x) => set(i, "brand_activity", x.target.value)} /></TableCell>
              <TableCell><Input className="min-w-24" value={b.default_unit ?? ""} onChange={(x) => set(i, "default_unit", x.target.value)} /></TableCell>
              {entities.map(e => <TableCell key={e.code}><Input className="min-w-36" aria-label={`${b.brand_activity || "New brand"} supplier ${e.code}`} value={b.suppliers[e.code] ?? "TO SET"} onChange={x => setRows(r => r.map((b, j) => j === i ? { ...b, suppliers: { ...b.suppliers, [e.code]: x.target.value } } : b))} /></TableCell>)}
              <TableCell className="space-x-2 whitespace-nowrap">
                <Button size="sm" onClick={() => save(b)}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => remove(b)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button variant="outline" onClick={() => setRows((r) => [...r, { brand_activity: "", suppliers: {}, default_unit: null, _new: true }])}>
        Add brand
      </Button>
    </div>
  );
}
