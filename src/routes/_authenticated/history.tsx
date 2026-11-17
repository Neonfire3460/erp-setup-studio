import { createFileRoute } from "@tanstack/react-router";
import { HistoryView } from "@/components/HistoryView";
import { historyOptions } from "@/lib/buildQueries";

export const Route = createFileRoute("/_authenticated/history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(historyOptions),
  head: () => ({
    meta: [
      { title: "History · NMK Unite" },
      { name: "description", content: "History page of the NMK Unite workspace." },
      { property: "og:title", content: "History · NMK Unite" },
      { property: "og:description", content: "History page of the NMK Unite workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryView,
});
