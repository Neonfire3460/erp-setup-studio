import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEYS = [
  ["default_inactive", "Inactive flag for items not in the ERP data"],
  ["default_webactive", "Webactive flag for items not in the ERP data"],
  ["default_b2b", "B2B flag for items not in the ERP data"],
  ["retail_change_warn_pct", "Warn when retail changes by more than (%)"],
] as const;

export function SettingsAdmin() {
  const [values, setValues] = useState<Record<string, string>>({});
  async function load() {
    const { data, error } = await supabase.from("app_settings").select("key,value");
    if (error) return void toast.error("Could not load settings");
    setValues(Object.fromEntries(data.map((r) => [r.key, String(r.value)])));
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    const rows = KEYS.map(([k]) => ({ key: k, value: Number(values[k]) }));
    if (rows.some((r) => !Number.isFinite(r.value))) return void toast.error("Every setting must be a number");
    if (rows.slice(0, 3).some((r) => r.value !== 0 && r.value !== 1)) return void toast.error("Flags must be 0 or 1");
    const { error } = await supabase.from("app_settings").upsert(rows);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  }
  return (
    <div className="max-w-md space-y-4">
      {KEYS.map(([k, label]) => <div key={k} className="space-y-2"><Label htmlFor={k}>{label}</Label><Input id={k} inputMode="decimal" className="w-32" value={values[k] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} /></div>)}
      <Button onClick={() => void save()}>Save settings</Button>
    </div>
  );
}
