import { createFileRoute, redirect } from "@tanstack/react-router";
import { TicketsPage } from "@/components/TicketsPage";
import { adminQuery } from "@/lib/workflow.queries";
import { headFor } from "@/lib/workflow";
export const Route = createFileRoute("/_authenticated/tickets")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/catalogue" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuery),
  head: () => headFor("Tickets", "Resolve missing pricing, exchange rates and supplier codes."),
  component: TicketsPage,
});
