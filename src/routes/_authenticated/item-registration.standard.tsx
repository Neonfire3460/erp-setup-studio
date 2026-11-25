import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { headFor } from "@/lib/v3/page";
import { Wizard } from "@/components/v3/wizard/Wizard";

export const Route = createFileRoute("/_authenticated/item-registration/standard")({
  validateSearch: z.object({ ticket: z.string().uuid().optional() }),
  head: () => headFor("Register NMK brands", "Register NMK brand items for the ERP, step by step."),
  component: StandardPage,
});

function StandardPage() {
  const { ticket } = Route.useSearch();
  return <Wizard key={ticket ?? "new"} ticketId={ticket} />;
}
