import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RuleEntity = { entity_code: string; ex_rate: number; overhead_pct: number; cost_basis: string; retail_method: string; round_to: number };
type Rule = {
  id: string;
  brand_activity: string;
  sub_activity: string;
  vendor_currency: string;
  cost_method: string;
  discount_pct: number;
  margin_divisors: number[];
  max_discount_pct: number | null;
  is_test: boolean;
  active: boolean;
  pricing_rule_entities: RuleEntity[];
};
type Entity = { code: string; name: string };

type Draft = {
  id?: string;
  brand_activity: string;
  sub_activity: string;
  vendor_currency: string;
  cost_method: string;
  discount_pct: string;
  margin_divisors: string;
  max_discount_pct: string;
  is_test: boolean;
  active: boolean;
  entities: Record<string, { ex_rate: string; overhead_pct: string; cost_basis: string; retail_method: string; round_to: string }>;
};

const emptyDraft = (): Draft => ({
  brand_activity: "", sub_activity: "", vendor_currency: "", cost_method: "discount_from_msrp",
  discount_pct: "0", margin_divisors: "", max_discount_pct: "", is_test: false, active: true, entities: {},
});

export function PricingRulesAdmin() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [r, e] = await Promise.all([
      supabase.from("pricing_rules").select("*, pricing_rule_entities(entity_code, ex_rate, overhead_pct, cost_basis, retail_method, round_to)").order("brand_activity").order("sub_activity").order("vendor_currency"),
      supabase.from("entities").select("code, name").order("sort_order"),
    ]);
    if (r.error) toast.error(r.error.message);
    else setRules(r.data as Rule[]);
    setEntities(e.data ?? []);
  }
  useEffect(() => { load(); }, []);

  function edit(r: Rule) {
    const ents: Draft["entities"] = {};
    r.pricing_rule_entities.forEach((e) => (ents[e.entity_code] = { ex_rate: String(e.ex_rate), overhead_pct: String(e.overhead_pct), cost_basis: e.cost_basis, retail_method: e.retail_method, round_to: String(e.round_to) }));
    setDraft({
      id: r.id, brand_activity: r.brand_activity, sub_activity: r.sub_activity, vendor_currency: r.vendor_currency,
      cost_method: r.cost_method, discount_pct: String(r.discount_pct), margin_divisors: r.margin_divisors.join(", "),
      max_discount_pct: r.max_discount_pct == null ? "" : String(r.max_discount_pct),
      is_test: r.is_test, active: r.active, entities: ents,
    });
  }

  async function toggleActive(r: Rule) {
    const { error } = await supabase.from("pricing_rules").update({ active: !r.active }).eq("id", r.id);
    if (error) toast.error(error.message);
    load();
  }

  async function save() {
    if (!draft) return;
    const divisors = draft.margin_divisors.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    if (!draft.brand_activity.trim() || !draft.sub_activity.trim() || !draft.vendor_currency.trim())
      { toast.error("Brand Activity, Sub Activity and currency are required"); return; }
    if (!divisors.length || divisors.some((d) => !(d > 0 && d <= 1)))
      { toast.error("Margin divisors must be numbers between 0 and 1, comma separated"); return; }
    const discount = Number(draft.discount_pct);
    if (Number.isNaN(discount) || discount < 0 || discount >= 100) { toast.error("Discount must be 0 to 99.99"); return; }
    const maxDisc = draft.max_discount_pct.trim() === "" ? null : Number(draft.max_discount_pct);
    if (maxDisc !== null && (Number.isNaN(maxDisc) || maxDisc < 0 || maxDisc > 100)) { toast.error("Max discount must be 0 to 100"); return; }

    const entRows: RuleEntity[] = [];
    for (const [code, v] of Object.entries(draft.entities)) {
      if (v.ex_rate.trim() === "" && v.overhead_pct.trim() === "") continue;
      const ex = Number(v.ex_rate), oh = Number(v.overhead_pct || "0");
      if (!(ex > 0) || Number.isNaN(oh)) { toast.error(`Entity ${code}: rate must be > 0 and overhead a number`); return; }
      const step = Number(v.round_to);
      if (!Number.isFinite(step) || step <= 0) { toast.error(`Entity ${code}: rounding step must be greater than 0`); return; }
      entRows.push({ entity_code: code, ex_rate: ex, overhead_pct: oh, cost_basis: v.cost_basis, retail_method: v.retail_method, round_to: step });
    }

    setSaving(true);
    const payload = {
      brand_activity: draft.brand_activity.trim(), sub_activity: draft.sub_activity.trim(),
      vendor_currency: draft.vendor_currency.trim().toUpperCase(), cost_method: draft.cost_method,
      discount_pct: draft.cost_method === "net_price" ? 0 : discount, margin_divisors: divisors,
      max_discount_pct: maxDisc, is_test: draft.is_test, active: draft.active,
    };
    const res = draft.id
      ? await supabase.from("pricing_rules").update(payload).eq("id", draft.id).select("id").single()
      : await supabase.from("pricing_rules").insert(payload).select("id").single();
    if (res.error) { setSaving(false); toast.error(res.error.message) ; return; }
    const ruleId = res.data.id;
    const del = await supabase.from("pricing_rule_entities").delete().eq("rule_id", ruleId);
    if (del.error) { setSaving(false); toast.error(del.error.message) ; return; }
    if (entRows.length) {
      const ins = await supabase.from("pricing_rule_entities").insert(entRows.map((e) => ({ ...e, rule_id: ruleId })));
      if (ins.error) { setSaving(false); toast.error(ins.error.message) ; return; }
    }
    // keep brands in sync: every rule brand has a brands row
    await supabase.from("brands").upsert({ brand_activity: payload.brand_activity }, { onConflict: "brand_activity", ignoreDuplicates: true });
    setSaving(false);
    setDraft(null);
    toast.success("Rule saved");
    load();
  }

  const setD = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setEnt = (code: string, k: keyof Draft["entities"][string], v: string) =>
    setDraft((d) => d ? { ...d, entities: { ...d.entities, [code]: { ex_rate: "", overhead_pct: "", cost_basis: "vendor_price", retail_method: "calculate", round_to: "1", ...d.entities[code], [k]: v } } } : d);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Per entity: rate / overhead %, cost basis, retail method, rounding step.</p>
        <Button onClick={() => setDraft(emptyDraft())}>Add rule</Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Activity</TableHead><TableHead>Sub Activity</TableHead><TableHead>Currency</TableHead>
              <TableHead>Method</TableHead><TableHead>Discount %</TableHead><TableHead>Divisors</TableHead><TableHead>Max disc.</TableHead>
              {entities.map((e) => <TableHead key={e.code}>{e.code}</TableHead>)}
              <TableHead>Active</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id} className={r.active ? "" : "opacity-50"}>
                <TableCell className="whitespace-nowrap">{r.brand_activity} {r.is_test && <Badge variant="secondary">TEST</Badge>}</TableCell>
                <TableCell>{r.sub_activity}</TableCell>
                <TableCell>{r.vendor_currency}</TableCell>
                <TableCell className="whitespace-nowrap">{r.cost_method}</TableCell>
                <TableCell>{r.discount_pct}</TableCell>
                <TableCell>{r.margin_divisors.join(", ")}</TableCell>
                <TableCell>{r.max_discount_pct ?? ""}</TableCell>
                {entities.map((e) => {
                  const x = r.pricing_rule_entities.find((p) => p.entity_code === e.code);
                  return <TableCell key={e.code} className="whitespace-nowrap">{x ? <><div>{x.ex_rate} / {x.overhead_pct}</div><div>{x.cost_basis}</div><div>{x.retail_method}</div><div>Round to {x.round_to}</div></> : "-"}</TableCell>;
                })}
                <TableCell>{r.active ? "Yes" : "No"}</TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => edit(r)}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>{r.active ? "Deactivate" : "Activate"}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit pricing rule" : "Add pricing rule"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand Activity"><Input value={draft.brand_activity} onChange={(e) => setD({ brand_activity: e.target.value })} /></Field>
              <Field label="Sub Activity"><Input value={draft.sub_activity} onChange={(e) => setD({ sub_activity: e.target.value })} /></Field>
              <Field label="Vendor currency"><Input value={draft.vendor_currency} onChange={(e) => setD({ vendor_currency: e.target.value })} /></Field>
              <Field label="Cost method">
                <Select value={draft.cost_method} onValueChange={(v) => setD({ cost_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount_from_msrp">discount_from_msrp</SelectItem>
                    <SelectItem value="net_price">net_price</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Discount %"><Input type="number" value={draft.discount_pct} disabled={draft.cost_method === "net_price"} onChange={(e) => setD({ discount_pct: e.target.value })} /></Field>
              <Field label="Margin divisors (comma separated)"><Input value={draft.margin_divisors} onChange={(e) => setD({ margin_divisors: e.target.value })} placeholder="0.75, 0.75" /></Field>
              <Field label="Max discount % (optional)"><Input type="number" value={draft.max_discount_pct} onChange={(e) => setD({ max_discount_pct: e.target.value })} /></Field>
              <div className="flex items-end gap-6 pb-2">
                <label className="flex items-center gap-2 text-sm"><Switch checked={draft.is_test} onCheckedChange={(v) => setD({ is_test: v })} /> Test</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={draft.active} onCheckedChange={(v) => setD({ active: v })} /> Active</label>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Entities (leave both empty = not available)</Label>
                {entities.map((e) => (
                  <div key={e.code} className="grid grid-cols-2 items-center gap-2 border-b pb-3 sm:grid-cols-3">
                    <span className="text-sm">{e.code} {e.name}</span>
                    <Input aria-label={`${e.code} exchange rate`} placeholder="Exchange rate" value={draft.entities[e.code]?.ex_rate ?? ""} onChange={(x) => setEnt(e.code, "ex_rate", x.target.value)} />
                    <Input aria-label={`${e.code} overhead percent`} placeholder="Overhead %" value={draft.entities[e.code]?.overhead_pct ?? ""} onChange={(x) => setEnt(e.code, "overhead_pct", x.target.value)} />
                    <Field label="Cost basis"><Select value={draft.entities[e.code]?.cost_basis ?? "vendor_price"} onValueChange={v => setEnt(e.code, "cost_basis", v)}><SelectTrigger aria-label={`${e.code} cost basis`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vendor_price">Vendor Price</SelectItem><SelectItem value="local_msrp">Local MSRP</SelectItem></SelectContent></Select></Field>
                    <Field label="Retail method"><Select value={draft.entities[e.code]?.retail_method ?? "calculate"} onValueChange={v => setEnt(e.code, "retail_method", v)}><SelectTrigger aria-label={`${e.code} retail method`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="calculate">Calculate</SelectItem><SelectItem value="local_msrp">Local MSRP</SelectItem></SelectContent></Select></Field>
                    <Field label="Round to"><Input aria-label={`${e.code} rounding step`} type="number" min="0.01" step="any" value={draft.entities[e.code]?.round_to ?? "1"} onChange={x => setEnt(e.code, "round_to", x.target.value)} /></Field>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
