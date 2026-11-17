import { createFileRoute } from "@tanstack/react-router";
import { ReviewDetail } from "@/components/ReviewPage";
import { adminQuery, detailQuery } from "@/lib/workflow.queries";
import { headFor } from "@/lib/workflow";
export const Route = createFileRoute("/_authenticated/review-queue/$id")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(adminQuery),
      context.queryClient.ensureQueryData(detailQuery(params.id)),
    ]);
  },
  head: () => headFor("Submission Review", "Review entity output, checks and ERP price changes."),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return <ReviewDetail id={id} />;
}
