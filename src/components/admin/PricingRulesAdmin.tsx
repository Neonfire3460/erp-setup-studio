import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Rule = { id: string; brand_activity: string; sub_activity: string | null; entity_code: string; overhead_pct: number; margin_divisors: number[]; round_to: number; max_discount_pct: number | null; compare_with_msrp: boolean; active: boolean; updated_at: string };
type Draft = { id?: string; brand_activity: string; sub_activity: string; entity_code: string; overhead_pct: string; margin_divisors: string; round_to: string; max_discount_pct: string; compare_with_msrp: boolean; active: boolean };
const ALL = "__all__";
const empty = (brand = ""): Draft => ({ brand_activity: brand, sub_activity: ALL, entity_code: "", overhead_pct: "0", margin_divisors: "", round_to: "1", max_discount_pct: "", compare_with_msrp: false, active: true });

export function parseDivisors(s: string): number[] | null {
  const parts = s.split(/[\s,÷]+/).filter(Boolean).map(Number);
  return parts.length && parts.every((n) => Number.isFinite(n) && n > 0 && n <= 1) ? parts : null;
}

export function PricingRulesAdmin() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [brands, setBrands] = useState<{ brand_activity: string; subs: string[] }[]>([]);
  const [entities, setEntities] = useState<{ code: string; name: string }[]>([]);
  const [filter, setFilter] = useState(ALL);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [r, b, s, e] = await Promise.all([
      supabase.from("pricing_rules").select("*").order("brand_activity").order("entity_code"),
      supabase.from("brands").select("brand_activity").order("brand_activity"),
      supabase.from("sub_activities").select("brand_activity,sub_activity").eq("active", true).order("sub_activity"),
      supabase.from("entities").select("code,name").order("sort_order"),
    ]);
    if (r.error || b.error || s.error || e.error) { toast.error("Could not load pricing rules"); return; }
    setRules(r.data as Rule[]);
    setBrands(b.data.map((x) => ({ brand_activity: x.brand_activity, subs: s.data.filter((y) => y.brand_activity === x.brand_activity).map((y) => y.sub_activity) })));
    setEntities(e.data);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!draft) return;
    const divisors = parseDivisors(draft.margin_divisors);
    const overhead = Number(draft.overhead_pct), round = Number(draft.round_to), maxd = draft.max_discount_pct.trim() === "" ? null : Number(draft.max_discount_pct);
    if (!draft.brand_activity || !draft.entity_code) return void toast.error("Brand and entity are required");
    if (!divisors) return void toast.error("Margin divisors: one or more numbers between 0 and 1");
    if (!Number.isFinite(overhead) || !(round > 0) || (maxd !== null && !Number.isFinite(maxd))) return void toast.error("Check overhead, round to and max discount");
    setSaving(true);
    const row = { brand_activity: draft.brand_activity, sub_activity: draft.sub_activity === ALL ? null : draft.sub_activity, entity_code: draft.entity_code, method: "calculate", overhead_pct: overhead, margin_divisors: divisors, round_to: round, max_discount_pct: maxd, compare_with_msrp: draft.compare_with_msrp, active: draft.active };
    const res = draft.id ? await supabase.from("pricing_rules").update(row).eq("id", draft.id) : await supabase.from("pricing_rules").insert(row);
    setSaving(false);
    if (res.error) return void toast.error(res.error.code === "23505" ? "A rule for this brand, sub activity and entity already exists" : res.error.message);
    toast.success("Rule saved"); setDraft(null); void load();
  }
  async function toggle(r: Rule) {
    const res = await supabase.from("pricing_rules").update({ active: !r.active }).eq("id", r.id);
    if (res.error) toast.error(res.error.message); else void load();
  }

  const shown = rules.filter((r) => filter === ALL || r.brand_activity === filter);
  const subs = brands.find((b) => b.brand_activity === draft?.brand_activity)?.subs ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60 space-y-2"><Label>Brand</Label><Select value={filter} onValueChange={setFilter}><SelectTrigger className="bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All brands</SelectItem>{brands.map((b) => <SelectItem key={b.brand_activity} value={b.brand_activity}>{b.brand_activity}</SelectItem>)}</SelectContent></Select></div>
        <Button onClick={() => setDraft(empty(filter === ALL ? "" : filter))}>Add rule</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Sub activity</TableHead><TableHead>Entity</TableHead><TableHead className="text-right">Overhead %</TableHead><TableHead>Divisors</TableHead><TableHead className="text-right">Round to</TableHead><TableHead className="text-right">Max discount</TableHead><TableHead>Compare MSRP</TableHead><TableHead>Updated</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {shown.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No pricing rules.</TableCell></TableRow>}
          {shown.map((r) => (
            <TableRow key={r.id} className={r.active ? "" : "opacity-50"}>
              <TableCell className="font-semibold">{r.brand_activity}</TableCell>
              <TableCell>{r.sub_activity ?? "All"}</TableCell>
              <TableCell>{r.entity_code}</TableCell>
              <TableCell className="text-right">{r.overhead_pct}</TableCell>
              <TableCell>{r.margin_divisors.map((d) => `÷ ${d}`).join(" ")}</TableCell>
              <TableCell className="text-right">{r.round_to}</TableCell>
              <TableCell className="text-right">{r.max_discount_pct ?? ""}</TableCell>
              <TableCell>{r.compare_with_msrp ? "Yes" : "No"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}{!r.active && <Badge variant="outline" className="ml-2">Inactive</Badge>}</TableCell>
              <TableCell className="space-x-1 whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => setDraft({ id: r.id, brand_activity: r.brand_activity, sub_activity: r.sub_activity ?? ALL, entity_code: r.entity_code, overhead_pct: String(r.overhead_pct), margin_divisors: r.margin_divisors.join(" "), round_to: String(r.round_to), max_discount_pct: r.max_discount_pct === null ? "" : String(r.max_discount_pct), compare_with_msrp: r.compare_with_msrp, active: r.active })}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => void toggle(r)}>{r.active ? "Deactivate" : "Activate"}</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Sheet open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{draft?.id ? "Edit pricing rule" : "Add pricing rule"}</SheetTitle></SheetHeader>
          {draft && <div className="space-y-4 px-4">
            <div className="space-y-2"><Label>Brand</Label><Select value={draft.brand_activity} onValueChange={(v) => setDraft({ ...draft, brand_activity: v, sub_activity: ALL })}><SelectTrigger><SelectValue placeholder="Choose brand" /></SelectTrigger><SelectContent>{brands.map((b) => <SelectItem key={b.brand_activity} value={b.brand_activity}>{b.brand_activity}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Sub activity</Label><Select value={draft.sub_activity} onValueChange={(v) => setDraft({ ...draft, sub_activity: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All sub activities</SelectItem>{subs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Entity</Label><Select value={draft.entity_code} onValueChange={(v) => setDraft({ ...draft, entity_code: v })}><SelectTrigger><SelectValue placeholder="Choose entity" /></SelectTrigger><SelectContent>{entities.map((e) => <SelectItem key={e.code} value={e.code}>{e.code} {e.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Overhead %</Label><Input inputMode="decimal" value={draft.overhead_pct} onChange={(e) => setDraft({ ...draft, overhead_pct: e.target.value })} /></div>
              <div className="space-y-2"><Label>Round up to</Label><Select value={draft.round_to} onValueChange={(v) => setDraft({ ...draft, round_to: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["1", "10", "100", "1000"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Margin divisors</Label><Input placeholder="0.75 0.75" value={draft.margin_divisors} onChange={(e) => setDraft({ ...draft, margin_divisors: e.target.value })} /><p className="text-xs text-muted-foreground">{parseDivisors(draft.margin_divisors)?.map((d) => `÷ ${d}`).join(" ") ?? "One or more numbers between 0 and 1"}</p></div>
            <div className="space-y-2"><Label>Max discount %</Label><Input inputMode="decimal" value={draft.max_discount_pct} onChange={(e) => setDraft({ ...draft, max_discount_pct: e.target.value })} /></div>
            <Label className="flex items-center gap-2"><Checkbox checked={draft.compare_with_msrp} onCheckedChange={(v) => setDraft({ ...draft, compare_with_msrp: v === true })} />Compare with vendor MSRP</Label>
            <Label className="flex items-center gap-2"><Checkbox checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v === true })} />Active</Label>
          </div>}
          <SheetFooter><Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save"}</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
