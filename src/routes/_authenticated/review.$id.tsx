import { createFileRoute, redirect } from "@tanstack/react-router";
import { headFor } from "@/lib/v3/page";
import { TicketWorkspace } from "@/components/v3/TicketWorkspace";

export const Route = createFileRoute("/_authenticated/review/$id")({
  beforeLoad: ({ context }) => {
    if (!context.isReviewer) throw redirect({ to: "/home" });
  },
  head: () =>
    headFor("Review", "Tickets In review or On hold, oldest first. Open one to check and edit it."),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <TicketWorkspace key={id} id={id} mode="review" />;
}
