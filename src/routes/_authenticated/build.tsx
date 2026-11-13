import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/build")({
  head: () => ({
    meta: [
      { title: "Build · NMK Pricelist to ERP" },
      { name: "description", content: "Build page of the NMK pricelist to ERP tool." },
      { property: "og:title", content: "Build · NMK Pricelist to ERP" },
      { property: "og:description", content: "Build page of the NMK pricelist to ERP tool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Build</h1>
      <p className="mt-2 text-sm text-muted-foreground">Not built yet.</p>
    </div>
  );
}
