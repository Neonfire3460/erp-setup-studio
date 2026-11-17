import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "@/components/ReviewPage";
import { adminQuery } from "@/lib/workflow.queries";
import { headFor } from "@/lib/workflow";
export const Route = createFileRoute("/_authenticated/review-queue/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuery),
  head: () => headFor("Review Queue", "Review and approve submitted ERP item updates."),
  component: ReviewQueue,
});
