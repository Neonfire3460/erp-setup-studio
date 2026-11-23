import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Boxes, Calculator, ShieldCheck, Library, Bot } from "lucide-react";
import { toast } from "sonner";
import { headFor } from "@/lib/v3/page";
import { PageHeader, Tile } from "@/components/v3/ui";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => headFor("Home", "NMK Unite tools."),
  component: HomePage,
});

const soon = () => toast("We're working on this", { description: "This tool is coming soon." });

function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader title="NMK Unite" description="Pick a tool to start." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile
          title="Item Registration Tool"
          subtitle="Register and price items for the ERP"
          icon={Boxes}
          live
          onClick={() => navigate({ to: "/item-registration" })}
        />
        <Tile title="Price Calculator Tool" icon={Calculator} live={false} onClick={soon} />
        <Tile title="Compliance" icon={ShieldCheck} live={false} onClick={soon} />
        <Tile title="Document Library" icon={Library} live={false} onClick={soon} />
        <Tile title="AI Agent" icon={Bot} live={false} onClick={soon} />
      </div>
    </div>
  );
}
