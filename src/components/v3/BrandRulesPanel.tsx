// BrandRulesPanel: the brand's pricing rules shown above the reviewer's grid, editable in place.
// It edits the same pricing_rules rows as Admin settings → Brands, so a change applies to this brand
// everywhere. Press Recalculate afterwards to rebuild this ticket's retail prices from the new values.
import { useCallback, useEffect, useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ListEditor, looseDb } from "@/components/v3/admin/ListEditor";
import { Card } from "@/components/v3/ui";

export function BrandRulesPanel({
  brand,
  entities,
  onSaved,
}: {
  brand: string;
  entities: { code: string; name: string }[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [subs, setSubs] = useState<string[]>([]);
  useEffect(() => {
    void looseDb
      .from("sub_activities")
      .select("sub_activity")
      .eq("brand_activity", brand)
      .order("sub_activity")
      .then((r: { data: { sub_activity: string }[] | null }) =>
        setSubs((r.data ?? []).map((x) => x.sub_activity)),
      );
  }, [brand]);
  const codes = entities.map((e) => e.code).join(",");
  const only = useCallback(
    (r: Record<string, unknown>) => codes.split(",").includes(String(r["entity_code"] ?? "")),
    [codes],
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="space-y-3 border-primary/30">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
          <Calculator className="size-4 text-primary" />
          <span className="font-bold">{brand} pricing rule</span>
          <span className="text-sm text-muted-foreground">
            for {entities.map((e) => e.code).join(", ")}
          </span>
          <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ListEditor
            table="pricing_rules"
            pk={["id"]}
            where={{ brand_activity: brand }}
            order="entity_code"
            filterRows={only}
            canDelete={false}
            onSaved={onSaved}
            defaults={{
              method: "calculate",
              overhead_pct: 0,
              margin_divisors: [],
              round_to: 1,
              active: true,
            }}
            note="Retail = cost × exchange rate × (1 + overhead %) ÷ each divisor, rounded up. Saving changes the rule for this brand everywhere, the same as Admin settings. Then press Recalculate to update this ticket."
            cols={[
              {
                key: "entity_code",
                label: "Entity",
                type: "select",
                options: entities.map((e) => ({ value: e.code, label: `${e.code} · ${e.name}` })),
                required: true,
                width: "150px",
              },
              {
                key: "sub_activity",
                label: "Sub Activity",
                type: "select",
                options: subs.map((s) => ({ value: s, label: s })),
                placeholder: "All",
                width: "140px",
              },
              { key: "overhead_pct", label: "Overhead %", type: "number", width: "90px" },
              {
                key: "margin_divisors",
                label: "Divisors",
                type: "numlist",
                placeholder: "0.5",
                width: "110px",
              },
              {
                key: "round_to",
                label: "Round up to",
                type: "select",
                options: [
                  { value: "1", label: "1" },
                  { value: "10", label: "10" },
                  { value: "100", label: "100" },
                ],
                width: "90px",
              },
              { key: "max_discount_pct", label: "Max discount %", type: "number", width: "100px" },
              { key: "active", label: "Active", type: "bool" },
            ]}
          />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
