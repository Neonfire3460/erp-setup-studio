// Admin settings (A5). One page with tabs; ?tab= opens a tab directly (the Review page links here
// for missing setup), and ?brand= opens that brand in the Brands and Pricing rules tabs.
import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, PageHeader } from "@/components/v3/ui";
import { headFor } from "@/lib/v3/page";
import { defaultEntityLogo } from "@/lib/v3/logo";
import { ListEditor } from "@/components/v3/admin/ListEditor";
import { UsersTab } from "@/components/v3/admin/UsersTab";
import { BrandsTab } from "@/components/v3/admin/BrandsTab";
import { CategoriesTab } from "@/components/v3/admin/CategoriesTab";
import {
  AiTab,
  ChangeLogTab,
  EmailsTab,
  ErpDataTab,
  RulesTab,
  SelfTestTab,
} from "@/components/v3/admin/SettingsTabs";

const TABS = [
  ["users", "Users"],
  ["entities", "Entities"],
  ["currencies", "Currencies"],
  ["fx", "Exchange rates"],
  ["brands", "Brands and suppliers"],
  ["pricing", "Pricing rules"],
  ["units", "Units"],
  ["categories", "Categories"],
  ["erp", "ERP data"],
  ["ai", "AI learning"],
  ["emails", "Emails"],
  ["rules", "Rules"],
  ["selftest", "Self-test"],
  ["log", "Change log"],
] as const;
type Tab = (typeof TABS)[number][0];

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: z.object({ tab: z.string().optional(), brand: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (!context.isStaff) throw redirect({ to: "/home" });
  },
  head: () =>
    headFor(
      "Admin settings",
      "Users, entities, rates, brands, pricing rules, categories, emails and rules.",
    ),
  component: AdminPage,
});

function AdminPage() {
  const { tab, brand } = Route.useSearch();
  const { isAdmin } = Route.useRouteContext();
  const navigate = useNavigate({ from: "/admin" });
  const current: Tab = TABS.find(([k]) => k === tab)?.[0] ?? "users";
  const [entities, setEntities] = useState<{ code: string; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [units, setUnits] = useState<{ code: string; name: string }[]>([]);
  const [v, setV] = useState(0);
  useEffect(() => {
    void supabase
      .from("entities")
      .select("code,name")
      .order("sort_order")
      .then((r) => setEntities(r.data ?? []));
    void supabase
      .from("currencies")
      .select("code")
      .order("sort_order")
      .then((r) => setCurrencies((r.data ?? []).map((c) => c.code)));
    void supabase
      .from("units")
      .select("code,name")
      .order("sort_order")
      .then((r) => setUnits(r.data ?? []));
  }, [v]);
  const refresh = () => setV((x) => x + 1);
  const cur = currencies.map((c) => ({ value: c, label: c }));
  const ents = entities.map((e) => ({ value: e.code, label: `${e.code} · ${e.name}` }));

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Admin settings"
        description="Changes save to the database straight away and are kept in the Change log."
      />
      <Tabs
        value={current}
        onValueChange={(t) => navigate({ search: { tab: t, ...(brand ? { brand } : {}) } })}
        className="min-w-0"
      >
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap justify-start">
            {TABS.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="users">
          <UsersTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="entities">
          <Card>
            <ListEditor
              table="entities"
              pk={["code"]}
              order="sort_order"
              onSaved={refresh}
              canDelete={false}
              defaults={{
                active: true,
                is_master: false,
                pdf_allowed: false,
                region: "Middle East",
                sort_order: 99,
                legal_name: "",
                pdf_terms_line: "",
              }}
              note="One master per region: its ERP data is used when an entity has none. PDF allowed = the PDF Pricelist can be made for it. The logo prints top right on the PDF."
              cols={[
                { key: "code", label: "Code", lockOnEdit: true, required: true, width: "70px" },
                { key: "name", label: "Name", required: true, width: "150px" },
                { key: "legal_name", label: "Legal name (PDF footer)", width: "240px" },
                {
                  key: "region",
                  label: "Region",
                  type: "select",
                  options: [
                    { value: "Middle East", label: "Middle East" },
                    { value: "South East Asia", label: "South East Asia" },
                  ],
                  required: true,
                  width: "140px",
                },
                {
                  key: "currency",
                  label: "Currency",
                  type: "select",
                  options: cur,
                  required: true,
                  width: "80px",
                },
                { key: "is_master", label: "Master", type: "bool" },
                { key: "pdf_allowed", label: "PDF", type: "bool" },
                {
                  key: "pdf_terms_line",
                  label: "PDF terms line",
                  placeholder: "Ex-works Dubai, UAE, DDP, VAT is extra",
                  width: "240px",
                },
                {
                  key: "pdf_logo_path",
                  label: "PDF logo",
                  type: "logo",
                  fallback: (r) => (r["code"] ? defaultEntityLogo(String(r["code"])) : null),
                  width: "170px",
                },
                { key: "sort_order", label: "Order", type: "number", width: "60px" },
                { key: "active", label: "Active", type: "bool" },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="currencies">
          <Card>
            <ListEditor
              table="currencies"
              pk={["code"]}
              order="sort_order"
              onSaved={refresh}
              defaults={{ active: true, sort_order: 99 }}
              cols={[
                { key: "code", label: "Code", lockOnEdit: true, required: true, width: "80px" },
                { key: "name", label: "Name", width: "200px" },
                { key: "sort_order", label: "Order", type: "number", width: "70px" },
                { key: "active", label: "Active", type: "bool" },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="fx">
          <Card>
            <ListEditor
              table="fx_rates"
              pk={["from_currency", "to_currency"]}
              order="from_currency"
              note="1 unit of From = Rate units of To. Example: USD → AED 3.675. Used to turn the vendor's cost into the entity's currency. Confidential: only staff see rates."
              cols={[
                {
                  key: "from_currency",
                  label: "From",
                  type: "select",
                  options: cur,
                  lockOnEdit: true,
                  required: true,
                  width: "90px",
                },
                {
                  key: "to_currency",
                  label: "To",
                  type: "select",
                  options: cur,
                  lockOnEdit: true,
                  required: true,
                  width: "90px",
                },
                { key: "rate", label: "Rate", type: "number", required: true, width: "120px" },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="brands">
          <BrandsTab entities={entities} units={units} initialBrand={brand} />
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <ListEditor
              key={brand ?? "all"}
              table="pricing_rules"
              pk={["id"]}
              order="brand_activity"
              searchable
              where={brand ? { brand_activity: brand } : {}}
              defaults={{
                method: "calculate",
                overhead_pct: 0,
                margin_divisors: [],
                round_to: 1,
                active: true,
                ...(brand ? { brand_activity: brand } : {}),
              }}
              note={`${brand ? `Rules of ${brand}. ` : ""}Retail = cost × exchange rate × (1 + overhead %) ÷ each divisor, rounded up. Leave Sub Activity empty for the whole brand.`}
              cols={[
                {
                  key: "brand_activity",
                  label: "Brand",
                  lockOnEdit: true,
                  required: true,
                  width: "150px",
                },
                {
                  key: "entity_code",
                  label: "Entity",
                  type: "select",
                  options: ents,
                  required: true,
                  width: "150px",
                },
                { key: "sub_activity", label: "Sub Activity", placeholder: "All", width: "120px" },
                { key: "overhead_pct", label: "Overhead %", type: "number", width: "90px" },
                {
                  key: "margin_divisors",
                  label: "Divisors",
                  type: "numlist",
                  placeholder: "0.5",
                  width: "100px",
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
                {
                  key: "max_discount_pct",
                  label: "Max discount %",
                  type: "number",
                  width: "100px",
                },
                { key: "active", label: "Active", type: "bool" },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <Card>
            <ListEditor
              table="units"
              pk={["code"]}
              order="sort_order"
              onSaved={refresh}
              defaults={{ active: true, sort_order: 99 }}
              note="Codes must match the ERP's measurement units."
              cols={[
                { key: "code", label: "Code", lockOnEdit: true, required: true, width: "90px" },
                { key: "name", label: "Name", width: "200px" },
                { key: "sort_order", label: "Order", type: "number", width: "70px" },
                { key: "active", label: "Active", type: "bool" },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="erp">
          <ErpDataTab />
        </TabsContent>
        <TabsContent value="ai">
          <AiTab />
        </TabsContent>
        <TabsContent value="emails">
          <EmailsTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
        <TabsContent value="selftest">
          <SelfTestTab />
        </TabsContent>
        <TabsContent value="log">
          <ChangeLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
