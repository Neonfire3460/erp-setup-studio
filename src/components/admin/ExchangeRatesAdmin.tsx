import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ExchangeRatesAdmin() {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [entities, setEntities] = useState<{ code: string; currency: string }[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});

  async function load() {
    const [c, e, r] = await Promise.all([
      supabase.from("currencies").select("code").eq("active", true).order("sort_order"),
      supabase.from("entities").select("code,currency").eq("active", true).order("sort_order"),
      supabase.from("exchange_rates").select("from_currency,entity_code,rate"),
    ]);
    if (c.error || e.error || r.error) { toast.error("Could not load exchange rates"); return; }
    setCurrencies(c.data.map((x) => x.code)); setEntities(e.data);
    const m = Object.fromEntries(r.data.map((x) => [`${x.from_currency}>${x.entity_code}`, String(x.rate)]));
    setRates(m); setSaved(m);
  }
  useEffect(() => { void load(); }, []);

  async function commit(cur: string, ent: string) {
    const key = `${cur}>${ent}`, v = (rates[key] ?? "").trim();
    if (v === (saved[key] ?? "")) return;
    if (v === "") {
      const res = await supabase.from("exchange_rates").delete().eq("from_currency", cur).eq("entity_code", ent);
      if (res.error) return void toast.error(res.error.message);
    } else {
      const n = Number(v);
      if (!(n > 0)) { toast.error("A rate must be a number above 0"); setRates((r) => ({ ...r, [key]: saved[key] ?? "" })); return; }
      const res = await supabase.from("exchange_rates").upsert({ from_currency: cur, entity_code: ent, rate: n });
      if (res.error) return void toast.error(res.error.message);
    }
    setSaved((s) => ({ ...s, [key]: v })); toast.success(`1 ${cur} → ${ent} saved`);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">1 unit of the row currency in each entity's currency. Same currency is always 1. Leave empty when unknown: submissions then open a ticket.</p>
      <Table>
        <TableHeader><TableRow><TableHead>From</TableHead>{entities.map((e) => <TableHead key={e.code}>{e.code} ({e.currency})</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {currencies.map((cur) => (
            <TableRow key={cur}>
              <TableCell className="font-semibold">{cur}</TableCell>
              {entities.map((e) => {
                const key = `${cur}>${e.code}`;
                return <TableCell key={e.code}>{cur === e.currency ? <span className="text-muted-foreground">1</span> : <Input aria-label={`1 ${cur} in ${e.code}`} className="w-24" inputMode="decimal" value={rates[key] ?? ""} onChange={(x) => setRates((r) => ({ ...r, [key]: x.target.value }))} onBlur={() => void commit(cur, e.code)} onKeyDown={(x) => { if (x.key === "Enter") (x.target as HTMLInputElement).blur(); }} />}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
