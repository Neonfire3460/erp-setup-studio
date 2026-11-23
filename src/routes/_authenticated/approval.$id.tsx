import { createFileRoute, redirect } from "@tanstack/react-router";
import { headFor } from "@/lib/v3/page";
import { TicketWorkspace } from "@/components/v3/TicketWorkspace";

export const Route = createFileRoute("/_authenticated/approval/$id")({
  beforeLoad: ({ context }) => {
    if (!context.isApprover) throw redirect({ to: "/home" });
  },
  head: () => headFor("Approval", "Tickets awaiting your approval."),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <TicketWorkspace key={id} id={id} mode="approval" />;
}
