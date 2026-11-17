import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/ComingNext";

export const Route = createFileRoute("/_authenticated/build")({
  head: () => ({
    meta: [
      { title: "Build · NMK Unite" },
      { name: "description", content: "Fill a template per entity and submit it for review." },
      { property: "og:title", content: "Build · NMK Unite" },
      { property: "og:description", content: "Fill a template per entity and submit it for review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingNext title="Build" text="Fill a template per entity and submit it for review." />,
});
