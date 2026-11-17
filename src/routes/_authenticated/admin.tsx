import { createFileRoute, redirect } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { EntitiesAdmin } from "@/components/admin/EntitiesAdmin";
import { BrandsAdmin } from "@/components/admin/BrandsAdmin";
import { PricingRulesAdmin } from "@/components/admin/PricingRulesAdmin";
import { ErpItemsAdmin } from "@/components/admin/ErpItemsAdmin";
import { SelfTestAdmin } from "@/components/admin/SelfTestAdmin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin · NMK Unite" },
      { name: "description", content: "Admin area: users, entities, brands, pricing rules and ERP master data." },
      { property: "og:title", content: "Admin · NMK Unite" },
      { property: "og:description", content: "Admin area: users, entities, brands, pricing rules and ERP master data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/convert" });
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="nmk-admin min-w-0 space-y-6">
      <div><h1 className="nmk-page-heading">Admin</h1><p className="mt-1 text-sm text-muted-foreground">Entities, brands, pricing rules and ERP master data.</p></div>
      <Tabs defaultValue="rules" className="min-w-0">
        <TabsList>
          <TabsTrigger value="rules">Pricing rules</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="erp">ERP master data</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="selftest">Pricing self-test</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><PricingRulesAdmin /></TabsContent>
        <TabsContent value="entities"><EntitiesAdmin /></TabsContent>
        <TabsContent value="brands"><BrandsAdmin /></TabsContent>
        <TabsContent value="erp"><ErpItemsAdmin /></TabsContent>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
        <TabsContent value="selftest"><SelfTestAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}
