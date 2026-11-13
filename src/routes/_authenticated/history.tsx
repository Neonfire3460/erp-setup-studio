import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History · NMK Pricelist to ERP" },
      { name: "description", content: "History page of the NMK pricelist to ERP tool." },
      { property: "og:title", content: "History · NMK Pricelist to ERP" },
      { property: "og:description", content: "History page of the NMK pricelist to ERP tool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <h1 className="text-xl font-semibold">History</h1>
      <p className="mt-2 text-sm text-muted-foreground">Not built yet.</p>
    </div>
  );
}
