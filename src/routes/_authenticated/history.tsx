import { createFileRoute } from "@tanstack/react-router";
import { HistoryView } from "@/components/HistoryView";
import { historyOptions } from "@/lib/buildQueries";

export const Route = createFileRoute("/_authenticated/history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(historyOptions),
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
  component: HistoryView,
});
