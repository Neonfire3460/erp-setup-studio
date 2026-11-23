import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { headFor } from "@/lib/v3/page";
import { PageHeader } from "@/components/v3/ui";
import { ErpImport } from "@/components/v3/ErpImport";

export const Route = createFileRoute("/_authenticated/erp-import")({
  validateSearch: z.object({ entity: z.string().optional(), brand: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (!context.isReviewer) throw redirect({ to: "/home" });
  },
  head: () =>
    headFor("ERP data import", "Import an ERP export: only the brands in the file are replaced."),
  component: Page,
});

function Page() {
  const { entity, brand } = Route.useSearch();
  return (
    <div className="space-y-6">
      <PageHeader
        title="ERP data import"
        description="Upload one entity's ERP export. The site finds the brands in it and replaces only those brands, then checks uploaded tickets against it."
      />
      <ErpImport initialEntity={entity} focusBrand={brand} />
    </div>
  );
}
