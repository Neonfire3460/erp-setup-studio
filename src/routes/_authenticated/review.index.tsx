import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { headFor } from "@/lib/v3/page";
import { staffQueue } from "@/lib/v3/tickets.functions";
import { Empty, PageHeader } from "@/components/v3/ui";
import { QueueTable } from "@/components/v3/TicketWorkspace";

export const Route = createFileRoute("/_authenticated/review/")({
  beforeLoad: ({ context }) => {
    if (!context.isReviewer) throw redirect({ to: "/home" });
  },
  head: () =>
    headFor("Review", "Tickets grouped by when they are needed. Open one to check and edit it."),
  component: Queue,
});

function Queue() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["queue", "review"],
    queryFn: () => staffQueue({ data: { view: "review" } }),
    refetchInterval: 60000,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Review"
        description="Grouped by when the brand manager needs them: overdue first, then this week and next week."
      />
      {!isLoading && !data?.length ? (
        <Empty icon={Inbox} text="Nothing is waiting here." />
      ) : (
        <QueueTable
          mode="review"
          rows={data ?? []}
          onOpen={(id) => navigate({ to: "/review/$id", params: { id } })}
        />
      )}
    </div>
  );
}
