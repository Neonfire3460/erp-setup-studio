import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/ComingNext";

export const Route = createFileRoute("/_authenticated/convert")({
  head: () => ({
    meta: [
      { title: "Convert · NMK Unite" },
      { name: "description", content: "Turn a vendor pricelist into a submission." },
      { property: "og:title", content: "Convert · NMK Unite" },
      { property: "og:description", content: "Turn a vendor pricelist into a submission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingNext title="Convert" text="Turn a vendor pricelist into a submission." />,
});
