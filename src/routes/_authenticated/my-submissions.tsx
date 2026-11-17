import { createFileRoute } from "@tanstack/react-router";
import { MySubmissions } from "@/components/MySubmissions";
import { submissionsQuery } from "@/lib/workflow.queries";

export const Route = createFileRoute("/_authenticated/my-submissions")({
  loader: ({ context }) => context.queryClient.ensureQueryData(submissionsQuery),
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
  component: MySubmissions,
});
