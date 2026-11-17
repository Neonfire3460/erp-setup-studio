import { createFileRoute, redirect } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { EntitiesAdmin } from "@/components/admin/EntitiesAdmin";
import { BrandsAdmin } from "@/components/admin/BrandsAdmin";
import { PricingRulesAdmin } from "@/components/admin/PricingRulesAdmin";
import { ErpDataAdmin } from "@/components/admin/ErpDataAdmin";
import { ExchangeRatesAdmin } from "@/components/admin/ExchangeRatesAdmin";
import { SettingsAdmin } from "@/components/admin/SettingsAdmin";
import { SelfTestAdmin } from "@/components/admin/SelfTestAdmin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin · NMK Unite" },
      { name: "description", content: "Admin area: pricing rules, exchange rates, brands, entities, ERP data, settings and users." },
      { property: "og:title", content: "Admin · NMK Unite" },
      { property: "og:description", content: "Admin area: pricing rules, exchange rates, brands, entities, ERP data, settings and users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/catalogue" });
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="nmk-admin min-w-0 space-y-6">
      <div><h1 className="nmk-page-heading">Admin</h1><p className="mt-1 text-sm text-muted-foreground">Pricing rules, exchange rates, brands, entities, ERP data and settings.</p></div>
      <Tabs defaultValue="rules" className="min-w-0">
        <TabsList>
          <TabsTrigger value="rules">Pricing rules</TabsTrigger>
          <TabsTrigger value="rates">Exchange rates</TabsTrigger>
          <TabsTrigger value="brands">Brands and suppliers</TabsTrigger>
          <TabsTrigger value="entities">Entities and currencies</TabsTrigger>
          <TabsTrigger value="erp">ERP data</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="selftest">Pricing self-test</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><PricingRulesAdmin /></TabsContent>
        <TabsContent value="rates"><ExchangeRatesAdmin /></TabsContent>
        <TabsContent value="brands"><BrandsAdmin /></TabsContent>
        <TabsContent value="entities"><EntitiesAdmin /></TabsContent>
        <TabsContent value="erp"><ErpDataAdmin /></TabsContent>
        <TabsContent value="settings"><SettingsAdmin /></TabsContent>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
        <TabsContent value="selftest"><SelfTestAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}
