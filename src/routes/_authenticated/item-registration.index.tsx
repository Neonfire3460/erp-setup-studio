import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Handshake, ListTree, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { headFor } from "@/lib/v3/page";
import { listMyTickets } from "@/lib/v3/wizard.functions";
import { Card, Label11, PageHeader, fmtDate } from "@/components/v3/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/item-registration/")({
  head: () => headFor("Register items", "Register NMK brand items, make PDF pricelists."),
  component: ItemRegistrationMenu,
});

const soon = () => toast("We're working on this", { description: "This is coming soon." });
const STEPS = ["Brand", "Prices", "Check", "New items", "Suppliers", "Check", "Send"];

function ItemRegistrationMenu() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => listMyTickets(),
    staleTime: 30_000,
  });
  const drafts = (data ?? []).filter((t) => t.status === "draft");
  return (
    <div className="space-y-6">
      <PageHeader
        title="What are you registering?"
        description="Pick one. Your drafts are saved as you go."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <FeatureCard
          accent="indigo"
          badge="Most used"
          title="NMK brands"
          text="Upload the vendor's pricelist and the AI reads it, or use our template. We check every price against the ERP for you."
          cta="Start registering"
          onClick={() =>
            navigate({ to: "/item-registration/standard", search: { ticket: undefined } })
          }
          preview={<RegisterPreview />}
          footer={
            <span className="flex flex-wrap gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={i}
                  className="rounded-md bg-[#EEF0FF] px-2 py-1 text-[11px] font-bold text-[#3730A3]"
                >
                  {i + 1} {s}
                </span>
              ))}
            </span>
          }
        />
        <FeatureCard
          accent="teal"
          badge="Made from the ERP"
          title="PDF pricelist"
          text="Pick a brand and an entity. We build a branded PDF of its active items and list prices, straight from the ERP data."
          cta="Make a PDF"
          onClick={() => navigate({ to: "/pdf-pricelist" })}
          preview={<PdfPreview />}
          footer={
            <span className="flex flex-wrap gap-1.5">
              {["Brand logo", "Active items only", "List prices", "Ready to send"].map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-[#E6FAF9] px-2 py-1 text-[11px] font-bold text-[#0F766E]"
                >
                  {s}
                </span>
              ))}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["Third party brands", "Brands outside the NMK portfolio", Handshake],
            ["Bundles (BOM)", "Several items sold as one code", ListTree],
          ] as const
        ).map(([t, d, Icon]) => (
          <button
            key={t}
            type="button"
            onClick={soon}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-card/70 px-5 py-4 text-left transition hover:border-primary/40 hover:bg-card"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-bold">{t}</span>
              <span className="block text-sm text-muted-foreground">{d}</span>
            </span>
            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
              Coming soon
            </span>
          </button>
        ))}
      </div>

      {drafts.length > 0 && (
        <Card className="space-y-3">
          <Label11>Pick up where you left off</Label11>
          <div className="space-y-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-4 rounded-xl bg-muted/50 px-4 py-3 text-sm"
              >
                <span className="font-bold">{d.brand_activity ?? "No brand yet"}</span>
                <span className="flex gap-1" aria-label={`Step ${d.step} of 7`}>
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-6 rounded-full ${i < d.step ? "bg-[#5B4CF0]" : "bg-slate-200"}`}
                    />
                  ))}
                </span>
                <span className="text-muted-foreground">
                  Step {d.step} of 7 · {STEPS[Math.max(0, d.step - 1)]} · saved{" "}
                  {fmtDate(d.updated_at)}
                </span>
                <Button
                  size="sm"
                  className="ml-auto rounded-lg bg-[#5B4CF0] font-bold hover:bg-[#4B3CE0]"
                  onClick={() =>
                    navigate({ to: "/item-registration/standard", search: { ticket: d.id } })
                  }
                >
                  Continue draft
                  <ArrowRight />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function FeatureCard({
  accent,
  badge,
  title,
  text,
  cta,
  onClick,
  preview,
  footer,
}: {
  accent: "indigo" | "teal";
  badge: string;
  title: string;
  text: string;
  cta: string;
  onClick: () => void;
  preview: React.ReactNode;
  footer: React.ReactNode;
}) {
  const indigo = accent === "indigo";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border-2 bg-card text-left shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,0.14)] ${
        indigo
          ? "border-[#5B4CF0]/40 hover:border-[#5B4CF0]"
          : "border-[#1FB7B5]/40 hover:border-[#1FB7B5]"
      }`}
    >
      <div
        className={`relative h-48 overflow-hidden ${
          indigo
            ? "bg-gradient-to-br from-[#EEF0FF] via-[#F5F3FF] to-[#E6FAF9]"
            : "bg-gradient-to-br from-[#E6FAF9] via-[#F0FDFA] to-[#EEF0FF]"
        }`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(91,76,240,0.25) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        {preview}
        <span
          className={`absolute left-5 top-5 rounded-full px-3 py-1 text-xs font-bold text-white shadow ${
            indigo ? "bg-[#5B4CF0]" : "bg-[#0F9E9C]"
          }`}
        >
          {badge}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-7">
        <span className="text-[26px] font-extrabold tracking-[-0.02em]">{title}</span>
        <span className="text-[15px] text-muted-foreground">{text}</span>
        {footer}
        <span
          className={`mt-3 inline-flex h-12 w-fit items-center gap-2 rounded-xl px-6 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(76,64,230,0.28)] transition group-hover:gap-3 ${
            indigo
              ? "bg-gradient-to-r from-[#3B2FD9] to-[#5B4CF0]"
              : "bg-gradient-to-r from-[#0E8F8D] to-[#1FB7B5]"
          }`}
        >
          {cta}
          <ArrowRight className="size-4" />
        </span>
      </div>
    </button>
  );
}

/** Vendor sheet → AI → ERP rows, drawn with plain elements. */
function RegisterPreview() {
  const rows = [
    ["TAV-D2BEN", "1,240.00"],
    ["TAV-MIC-G", "186.50"],
    ["TAV-CHG", "412.00"],
  ];
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center gap-4 pt-6"
    >
      <div className="w-40 -rotate-3 rounded-xl border bg-white p-3 shadow-lg transition group-hover:-rotate-6">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <FileText className="size-3" /> vendor_pricelist.xlsx
        </p>
        {rows.map(([c]) => (
          <div key={c} className="mb-1.5 flex gap-1.5">
            <span className="h-2 w-14 rounded bg-slate-200" />
            <span className="h-2 flex-1 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-[#3B2FD9] to-[#1FB7B5] text-white shadow-lg">
        <Sparkles className="size-5" />
      </span>
      <div className="w-48 rotate-2 rounded-xl border bg-white p-3 shadow-lg transition group-hover:rotate-3">
        <p className="mb-2 text-[10px] font-bold text-[#3730A3]">Ready for the ERP</p>
        {rows.map(([c, p]) => (
          <div key={c} className="mb-1 flex items-center justify-between text-[10px]">
            <span className="font-bold text-slate-700">{c}</span>
            <span className="tabular-nums text-slate-500">{p}</span>
            <span className="text-[#0F9E9C]">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A small branded PDF page, made from ERP rows. */
function PdfPreview() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-end justify-center">
      <div className="absolute bottom-[-30px] h-48 w-40 translate-x-16 rotate-6 rounded-lg border bg-white shadow-md" />
      <div className="relative bottom-[-24px] h-48 w-44 -rotate-2 overflow-hidden rounded-lg border bg-white shadow-xl transition group-hover:-translate-y-2 group-hover:-rotate-3">
        <div className="flex items-center gap-1.5 bg-[#0B1460] px-3 py-2">
          <img src="/brand/nmk-mark.png" alt="" className="h-3.5 w-auto" />
          <span className="text-[9px] font-bold text-white">Your brand · Price list</span>
        </div>
        <div className="space-y-1.5 p-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-1.5 w-9 rounded bg-slate-300" />
              <span className="h-1.5 flex-1 rounded bg-slate-100" />
              <span className="h-1.5 w-6 rounded bg-[#1FB7B5]/60" />
            </div>
          ))}
        </div>
        <span className="absolute right-2 top-9 rounded bg-[#E6FAF9] px-1.5 py-0.5 text-[8px] font-bold text-[#0F766E]">
          PDF
        </span>
      </div>
    </div>
  );
}
