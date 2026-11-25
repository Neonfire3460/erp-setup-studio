import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, FileText, Handshake, ListTree } from "lucide-react";
import { toast } from "sonner";
import { headFor } from "@/lib/v3/page";
import { listMyTickets } from "@/lib/v3/wizard.functions";
import { Card, Label11, PageHeader, Tile, fmtDate } from "@/components/v3/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/item-registration/")({
  head: () => headFor("Register items", "Register NMK brand items, make PDF pricelists."),
  component: ItemRegistrationMenu,
});

const soon = () => toast("We're working on this", { description: "This is coming soon." });

function ItemRegistrationMenu() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["my-tickets"], queryFn: () => listMyTickets() });
  const drafts = (data ?? []).filter((t) => t.status === "draft");
  return (
    <div className="space-y-6">
      <PageHeader
        title="What are you registering?"
        description="Pick one. Your drafts are saved as you go."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          title="NMK brands"
          subtitle="Upload the vendor pricelist (the AI reads it) or our template. 7 short steps."
          icon={Boxes}
          live
          onClick={() =>
            navigate({ to: "/item-registration/standard", search: { ticket: undefined } })
          }
        />
        <Tile
          title="PDF Pricelist"
          subtitle="Pick a brand and an entity. Get a branded PDF of active items with list prices."
          icon={FileText}
          live
          onClick={() => navigate({ to: "/pdf-pricelist" })}
        />
        <Tile title="Third party brands" icon={Handshake} live={false} onClick={soon} />
        <Tile title="Bundles (BOM)" icon={ListTree} live={false} onClick={soon} />
      </div>
      {drafts.length > 0 && (
        <Card>
          <Label11>Pick up where you left off</Label11>
          <div className="mt-3 divide-y">
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-semibold">{d.brand_activity}</span>
                <span className="text-muted-foreground">
                  Step {d.step} of 7 · saved {fmtDate(d.updated_at)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() =>
                    navigate({ to: "/item-registration/standard", search: { ticket: d.id } })
                  }
                >
                  Continue draft
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
