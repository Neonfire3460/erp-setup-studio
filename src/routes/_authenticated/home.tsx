import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, Boxes, Calculator, Database, Library, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { headFor } from "@/lib/v3/page";
import { listMyTickets } from "@/lib/v3/wizard.functions";
import { TicketStatusBadge, fmtDate } from "@/components/v3/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => headFor("Home", "NMK Unite tools."),
  component: HomePage,
});

const soon = () => toast("We're working on this", { description: "This tool is coming soon." });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function HomePage() {
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/_authenticated" });
  const { data } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => listMyTickets(),
    staleTime: 30_000,
  });
  const tickets = data ?? [];
  const drafts = tickets.filter((t) => t.status === "draft").length;
  const inReview = tickets.filter((t) =>
    ["submitted", "in_review", "awaiting_approval"].includes(t.status),
  ).length;
  const needYou = tickets.filter((t) => ["rejected", "on_hold"].includes(t.status)).length;
  const recent = tickets.slice(0, 4);
  const name = user.email?.split("@")[0]?.split(/[._]/)[0] ?? "";
  const nice = name ? name[0]!.toUpperCase() + name.slice(1) : "";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#0B1460] px-6 py-9 text-white sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 380px at 0% 120%, rgba(31,183,181,0.75) 0%, rgba(31,183,181,0) 60%), radial-gradient(600px 380px at 100% -20%, rgba(91,76,240,0.95) 0%, rgba(91,76,240,0) 62%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#C7CCF5]">
              {greeting()}
              {nice ? `, ${nice}` : ""}
            </p>
            <h1 className="text-5xl font-extrabold leading-none tracking-[-0.04em] sm:text-6xl">
              NMK{" "}
              <span className="bg-gradient-to-r from-white via-indigo-200 to-teal-300 bg-clip-text text-transparent">
                Unite
              </span>
            </h1>
            <p className="text-base text-[#D9DEFF]">Every NMK tool, in one place.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              ["Drafts to finish", drafts],
              ["In review", inReview],
              ["Need your answer", needYou],
            ].map(([label, n]) => (
              <Link
                key={label}
                to="/my-submissions"
                className="min-w-[130px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 transition hover:bg-white/15"
              >
                <p className="text-3xl font-extrabold tabular-nums">{n}</p>
                <p className="text-xs font-semibold text-[#C7CCF5]">{label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <HeroCard
          tone="indigo"
          icon={Boxes}
          title="Register items"
          text="Send new items and new prices to the ERP, from the vendor's own pricelist."
          chips={[
            ["NMK brands"],
            ["PDF pricelist"],
            ["Third party brands", "soon"],
            ["Bundles (BOM)", "soon"],
          ]}
          button="Start registering"
          onClick={() => navigate({ to: "/item-registration" })}
        />
        <HeroCard
          tone="teal"
          icon={Database}
          title="View ERP data"
          text="See your brands exactly as they are in the ERP, with prices and categories."
          chips={[["Active and inactive items"], ["Make items inactive"], ["Export to Excel"]]}
          button="Open ERP data"
          onClick={() => navigate({ to: "/erp-items" })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Price calculator", Calculator],
            ["Compliance", ShieldCheck],
            ["Document library", Library],
            ["Ask the AI agent", Bot],
          ] as const
        ).map(([t, Icon]) => (
          <button
            key={t}
            type="button"
            onClick={soon}
            className="flex items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-4 text-left text-muted-foreground transition hover:border-primary/40"
          >
            <Icon className="size-5" />
            <span className="text-sm font-semibold text-foreground">{t}</span>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
              Soon
            </span>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Recent requests
            </p>
            <Link
              to="/my-submissions"
              className="text-sm font-semibold text-primary hover:underline"
            >
              See all my requests
            </Link>
          </div>
          <div className="divide-y">
            {recent.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="font-semibold">{t.brand_activity ?? "No brand yet"}</span>
                <span className="text-muted-foreground">
                  {t.ticket_no ?? `Step ${t.step} of 7`} · {fmtDate(t.updated_at)}
                </span>
                <span className="ml-auto">
                  <TicketStatusBadge status={t.status} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function HeroCard({
  tone,
  icon: Icon,
  title,
  text,
  chips,
  button,
  onClick,
}: {
  tone: "indigo" | "teal";
  icon: typeof Boxes;
  title: string;
  text: string;
  chips: (readonly [string] | readonly [string, string])[];
  button: string;
  onClick: () => void;
}) {
  const indigo = tone === "indigo";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-4 rounded-3xl border-2 bg-card p-7 text-left shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 ${
        indigo
          ? "border-[#5B4CF0]/60 hover:border-[#5B4CF0]"
          : "border-[#1FB7B5]/60 hover:border-[#1FB7B5]"
      }`}
    >
      <span
        className={`flex size-14 items-center justify-center rounded-2xl text-white ${
          indigo
            ? "bg-gradient-to-br from-[#3B2FD9] to-[#5B4CF0]"
            : "bg-gradient-to-br from-[#0E8F8D] to-[#1FB7B5]"
        }`}
      >
        <Icon className="size-7" />
      </span>
      <span className="text-[28px] font-extrabold tracking-[-0.02em]">{title}</span>
      <span className="text-[15px] text-muted-foreground">{text}</span>
      <span className="flex flex-wrap gap-2">
        {chips.map(([c, s]) => (
          <span
            key={c}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              s
                ? "bg-muted text-muted-foreground"
                : indigo
                  ? "bg-[#EEF0FF] text-[#3730A3]"
                  : "bg-[#E6FAF9] text-[#0F766E]"
            }`}
          >
            {c}
            {s ? ` · ${s}` : ""}
          </span>
        ))}
      </span>
      <Button
        asChild
        className={`mt-2 h-12 w-fit rounded-xl px-6 text-[15px] font-bold ${
          indigo ? "bg-[#5B4CF0] hover:bg-[#4B3CE0]" : "bg-[#0F9E9C] hover:bg-[#0C8987]"
        }`}
      >
        <span>
          {button} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </span>
      </Button>
    </button>
  );
}
