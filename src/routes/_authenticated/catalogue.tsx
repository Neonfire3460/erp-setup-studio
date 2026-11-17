import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/ComingNext";

export const Route = createFileRoute("/_authenticated/catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue · NMK Unite" },
      { name: "description", content: "Browse approved items with their retail prices by entity and brand." },
      { property: "og:title", content: "Catalogue · NMK Unite" },
      { property: "og:description", content: "Browse approved items with their retail prices by entity and brand." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingNext title="Catalogue" text="Browse approved items with their retail prices by entity and brand." />,
});
