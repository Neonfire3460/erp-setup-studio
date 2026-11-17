import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/ComingNext";

export const Route = createFileRoute("/_authenticated/my-submissions")({
  head: () => ({
    meta: [
      { title: "My submissions · NMK Unite" },
      { name: "description", content: "Your submissions and their review status." },
      { property: "og:title", content: "My submissions · NMK Unite" },
      { property: "og:description", content: "Your submissions and their review status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingNext title="My submissions" text="Your submissions and their review status." />,
});
