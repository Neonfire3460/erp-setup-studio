import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { headFor } from "@/lib/v3/page";
import { staffQueue } from "@/lib/v3/tickets.functions";
import { Empty, PageHeader } from "@/components/v3/ui";
import { QueueTable } from "@/components/v3/TicketWorkspace";

export const Route = createFileRoute("/_authenticated/approval/")({
  beforeLoad: ({ context }) => {
    if (!context.isApprover) throw redirect({ to: "/home" });
  },
  head: () => headFor("Approval", "Tickets awaiting your approval."),
  component: Queue,
});

function Queue() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["queue", "approval"],
    queryFn: () => staffQueue({ data: { view: "approval" } }),
    refetchInterval: 60000,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Approval" description="Tickets awaiting your approval." />
      {!isLoading && !data?.length ? (
        <Empty icon={Inbox} text="Nothing is waiting here." />
      ) : (
        <QueueTable
          mode="approval"
          rows={data ?? []}
          onOpen={(id) => navigate({ to: "/approval/$id", params: { id } })}
        />
      )}
    </div>
  );
}
