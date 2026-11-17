import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Brand = { brand_activity: string; default_unit: string | null; active: boolean };
type Sub = { brand_activity: string; sub_activity: string; active: boolean };

export function BrandsAdmin() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [entities, setEntities] = useState<{ code: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [unit, setUnit] = useState("");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [newSub, setNewSub] = useState("");
  const [newBrand, setNewBrand] = useState("");

  async function loadBrands() {
    const [b, e] = await Promise.all([supabase.from("brands").select("*").order("brand_activity"), supabase.from("entities").select("code,name").order("sort_order")]);
    if (b.error || e.error) return void toast.error("Could not load brands");
    setBrands(b.data); setEntities(e.data);
  }
  async function loadBrand(brand: string) {
    const [s, sp] = await Promise.all([
      supabase.from("sub_activities").select("*").eq("brand_activity", brand).order("sub_activity"),
      supabase.from("brand_suppliers").select("entity_code,supplier").eq("brand_activity", brand),
    ]);
    if (s.error || sp.error) return void toast.error("Could not load brand");
    setSubs(s.data); setNames(Object.fromEntries(s.data.map((x) => [x.sub_activity, x.sub_activity])));
    setSuppliers(Object.fromEntries(sp.data.map((x) => [x.entity_code, x.supplier])));
    setUnit(brands.find((b) => b.brand_activity === brand)?.default_unit ?? "");
  }
  useEffect(() => { void loadBrands(); }, []);
  useEffect(() => { if (sel) void loadBrand(sel); }, [sel, brands]);

  const shown = useMemo(() => brands.filter((b) => b.brand_activity.toLowerCase().includes(search.toLowerCase())).slice(0, 300), [brands, search]);
  const brand = brands.find((b) => b.brand_activity === sel);

  async function addBrand() {
    const name = newBrand.trim(); if (!name) return;
    const { error } = await supabase.from("brands").insert({ brand_activity: name });
    if (error) return void toast.error(error.code === "23505" ? "Brand already exists" : error.message);
    setNewBrand(""); await loadBrands(); setSel(name);
  }
  async function saveBrand(patch: Partial<Brand>) {
    if (!sel) return;
    const { error } = await supabase.from("brands").update(patch).eq("brand_activity", sel);
    if (error) toast.error(error.message); else { toast.success("Saved"); void loadBrands(); }
  }
  async function addSub() {
    const s = newSub.trim(); if (!sel || !s) return;
    const { error } = await supabase.from("sub_activities").insert({ brand_activity: sel, sub_activity: s });
    if (error) return void toast.error(error.code === "23505" ? "Sub activity already exists" : error.message);
    setNewSub(""); void loadBrand(sel);
  }
  async function renameSub(old: string) {
    const v = (names[old] ?? "").trim(); if (!sel || !v || v === old) return;
    const { error } = await supabase.from("sub_activities").update({ sub_activity: v }).eq("brand_activity", sel).eq("sub_activity", old);
    if (error) toast.error(error.message); else { toast.success("Renamed"); void loadBrand(sel); }
  }
  async function toggleSub(s: Sub) {
    const { error } = await supabase.from("sub_activities").update({ active: !s.active }).eq("brand_activity", s.brand_activity).eq("sub_activity", s.sub_activity);
    if (error) toast.error(error.message); else if (sel) void loadBrand(sel);
  }
  async function saveSuppliers() {
    if (!sel) return;
    const keep = entities.filter((e) => suppliers[e.code]?.trim()).map((e) => ({ brand_activity: sel, entity_code: e.code, supplier: (suppliers[e.code] ?? "").trim() }));
    const clear = entities.filter((e) => !suppliers[e.code]?.trim()).map((e) => e.code);
    if (keep.length) { const r = await supabase.from("brand_suppliers").upsert(keep); if (r.error) return void toast.error(r.error.message); }
    if (clear.length) { const r = await supabase.from("brand_suppliers").delete().eq("brand_activity", sel).in("entity_code", clear); if (r.error) return void toast.error(r.error.message); }
    toast.success("Supplier codes saved");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <Input placeholder="Search brands" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[560px] overflow-y-auto rounded-[10px] border bg-card">
          {shown.map((b) => <button key={b.brand_activity} type="button" onClick={() => setSel(b.brand_activity)} className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted ${sel === b.brand_activity ? "bg-accent font-semibold text-primary" : ""} ${b.active ? "" : "opacity-50"}`}>{b.brand_activity}</button>)}
          {!shown.length && <p className="p-3 text-sm text-muted-foreground">No brands.</p>}
        </div>
        <p className="text-xs text-muted-foreground">{brands.length} brands</p>
        <div className="flex gap-2"><Input placeholder="New brand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} /><Button variant="outline" onClick={() => void addBrand()}>Add</Button></div>
      </div>
      {!brand ? <p className="text-sm text-muted-foreground">Pick a brand.</p> : (
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-end gap-4">
            <h2 className="w-full text-base font-semibold">{brand.brand_activity}</h2>
            <div className="space-y-2"><Label htmlFor="unit">Default unit</Label><Input id="unit" className="w-32" value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <Button variant="outline" onClick={() => void saveBrand({ default_unit: unit.trim() || null })}>Save unit</Button>
            <Label className="flex items-center gap-2"><Checkbox checked={brand.active} onCheckedChange={(v) => void saveBrand({ active: v === true })} />Active</Label>
          </div>
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Sub activities</h3>
            <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
              {subs.map((s) => <TableRow key={s.sub_activity} className={s.active ? "" : "opacity-50"}>
                <TableCell><Input className="min-w-48" value={names[s.sub_activity] ?? ""} onChange={(e) => setNames((n) => ({ ...n, [s.sub_activity]: e.target.value }))} /></TableCell>
                <TableCell>{s.active ? "Active" : "Inactive"}</TableCell>
                <TableCell className="space-x-1 whitespace-nowrap"><Button size="sm" variant="ghost" disabled={(names[s.sub_activity] ?? "").trim() === s.sub_activity} onClick={() => void renameSub(s.sub_activity)}>Rename</Button><Button size="sm" variant="ghost" onClick={() => void toggleSub(s)}>{s.active ? "Deactivate" : "Activate"}</Button></TableCell>
              </TableRow>)}
            </TableBody></Table>
            <div className="flex max-w-md gap-2"><Input placeholder="New sub activity" value={newSub} onChange={(e) => setNewSub(e.target.value)} /><Button variant="outline" onClick={() => void addSub()}>Add</Button></div>
          </section>
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase text-muted-foreground">Supplier code per entity</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {entities.map((e) => <div key={e.code} className="space-y-1"><Label htmlFor={`sup-${e.code}`}>{e.code} {e.name}</Label><Input id={`sup-${e.code}`} value={suppliers[e.code] ?? ""} onChange={(x) => setSuppliers((s) => ({ ...s, [e.code]: x.target.value }))} /></div>)}
            </div>
            <Button onClick={() => void saveSuppliers()}>Save supplier codes</Button>
          </section>
        </div>
      )}
    </div>
  );
}
