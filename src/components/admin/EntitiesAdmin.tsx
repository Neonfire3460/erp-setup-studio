import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type E = { code: string; name: string; region: string; currency: string; sort_order: number; active: boolean; _new?: boolean };
type C = { code: string; name: string; active: boolean; sort_order: number; _new?: boolean };
const REGIONS = ["Middle East", "South East Asia"];

export function EntitiesAdmin() {
  const [ents, setEnts] = useState<E[]>([]);
  const [curs, setCurs] = useState<C[]>([]);
  async function load() {
    const [e, c] = await Promise.all([supabase.from("entities").select("*").order("sort_order"), supabase.from("currencies").select("*").order("sort_order")]);
    if (e.error || c.error) return void toast.error("Could not load entities");
    setEnts(e.data); setCurs(c.data);
  }
  useEffect(() => { void load(); }, []);
  const setE = (i: number, p: Partial<E>) => setEnts((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setC = (i: number, p: Partial<C>) => setCurs((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function saveE({ _new, ...row }: E) {
    if (!row.code.trim() || !row.name.trim() || !row.currency) return void toast.error("Code, name and currency are required");
    const { error } = await supabase.from("entities").upsert({ ...row, code: row.code.trim() });
    if (error) toast.error(error.message); else { toast.success("Saved"); void load(); }
  }
  async function saveC({ _new, ...row }: C) {
    const code = row.code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return void toast.error("Currency code: 3 letters (ISO)");
    const { error } = await supabase.from("currencies").upsert({ ...row, code });
    if (error) toast.error(error.message); else { toast.success("Saved"); void load(); }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Entities</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Region</TableHead><TableHead>Currency</TableHead><TableHead>Sort</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{ents.map((e, i) => (
            <TableRow key={e._new ? `new-${i}` : e.code}>
              <TableCell><Input className="w-20" value={e.code} disabled={!e._new} onChange={(x) => setE(i, { code: x.target.value })} /></TableCell>
              <TableCell><Input className="min-w-40" value={e.name} onChange={(x) => setE(i, { name: x.target.value })} /></TableCell>
              <TableCell><Select value={e.region} onValueChange={(v) => setE(i, { region: v })}><SelectTrigger className="min-w-40"><SelectValue placeholder="Region" /></SelectTrigger><SelectContent>{REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></TableCell>
              <TableCell><Select value={e.currency} onValueChange={(v) => setE(i, { currency: v })}><SelectTrigger className="w-24"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{curs.filter((c) => !c._new).map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></TableCell>
              <TableCell><Input className="w-20" type="number" value={e.sort_order} onChange={(x) => setE(i, { sort_order: Number(x.target.value) })} /></TableCell>
              <TableCell><Checkbox aria-label={`${e.code} active`} checked={e.active} onCheckedChange={(v) => setE(i, { active: v === true })} /></TableCell>
              <TableCell><Button size="sm" onClick={() => void saveE(e)}>Save</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        <Button variant="outline" onClick={() => setEnts((r) => [...r, { code: "", name: "", region: "Middle East", currency: "", sort_order: r.length + 1, active: true, _new: true }])}>Add entity</Button>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Currencies</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Sort</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{curs.map((c, i) => (
            <TableRow key={c._new ? `new-${i}` : c.code}>
              <TableCell><Input className="w-20" value={c.code} disabled={!c._new} onChange={(x) => setC(i, { code: x.target.value })} /></TableCell>
              <TableCell><Input className="min-w-40" value={c.name} onChange={(x) => setC(i, { name: x.target.value })} /></TableCell>
              <TableCell><Input className="w-20" type="number" value={c.sort_order} onChange={(x) => setC(i, { sort_order: Number(x.target.value) })} /></TableCell>
              <TableCell><Checkbox aria-label={`${c.code} active`} checked={c.active} onCheckedChange={(v) => setC(i, { active: v === true })} /></TableCell>
              <TableCell><Button size="sm" onClick={() => void saveC(c)}>Save</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        <Button variant="outline" onClick={() => setCurs((r) => [...r, { code: "", name: "", active: true, sort_order: r.length + 1, _new: true }])}>Add currency</Button>
      </section>
    </div>
  );
}
