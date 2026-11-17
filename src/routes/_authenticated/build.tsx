import { createFileRoute } from "@tanstack/react-router";
import { BuildSubmission } from "@/components/BuildSubmission";
import { buildOptionsQuery, submissionsQuery } from "@/lib/workflow.queries";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/build")({
  validateSearch: z.object({ reuse: z.string().uuid().optional() }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(buildOptionsQuery),
      context.queryClient.ensureQueryData(submissionsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Build · NMK Unite" },
      { name: "description", content: "Fill a template per entity and submit it for review." },
      { property: "og:title", content: "Build · NMK Unite" },
      {
        property: "og:description",
        content: "Fill a template per entity and submit it for review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildPage,
});

function BuildPage() {
  const { reuse } = Route.useSearch();
  const { queryClient } = Route.useRouteContext();
  const submission = queryClient
    .getQueryData(submissionsQuery.queryKey)
    ?.find((s) => s.id === reuse);
  const entities = z
    .array(z.object({ entity_code: z.string(), cost_currency: z.string() }))
    .catch([])
    .parse(submission?.entities);
  return (
    <BuildSubmission
      key={reuse ?? "new"}
      preset={submission ? { brand: submission.brand_activity, entities } : undefined}
    />
  );
}
