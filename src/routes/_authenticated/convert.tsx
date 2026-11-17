import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/convert")({
  head: () => ({
    meta: [
      { title: "Convert · NMK Unite" },
      { name: "description", content: "Convert page of the NMK Unite workspace." },
      { property: "og:title", content: "Convert · NMK Unite" },
      { property: "og:description", content: "Convert page of the NMK Unite workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <h1 className="nmk-page-heading">Convert</h1>
      <p className="mt-2 text-sm text-muted-foreground">Not built yet.</p>
    </div>
  );
}
