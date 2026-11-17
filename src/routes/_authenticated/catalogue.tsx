import { createFileRoute } from "@tanstack/react-router";
import { CataloguePage, catalogueOptionsQuery } from "@/components/CataloguePage";

export const Route = createFileRoute("/_authenticated/catalogue")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogueOptionsQuery),
  head: () => ({
    meta: [
      { title: "Catalogue · NMK Unite" },
      {
        name: "description",
        content: "Browse approved items with their retail prices by entity and brand.",
      },
      { property: "og:title", content: "Catalogue · NMK Unite" },
      {
        property: "og:description",
        content: "Browse approved items with their retail prices by entity and brand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CataloguePage,
});
