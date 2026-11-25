// Standard Item Registration: Steps 1 to 7 with a draft saved after each step.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Stepper } from "@/components/Stepper";
import { Button } from "@/components/ui/button";
import { PageHeader, errText } from "@/components/v3/ui";
import { deleteDraft, getDraft, saveDraft, wizardOptions } from "@/lib/v3/wizard.functions";
import type { TicketDraft } from "@/lib/nmk/types";
import { STEPS, emptyDraft, type PriceCheckData, type StepProps } from "./shared";
import { StepBrand, StepPrices } from "./StepsStart";
import { StepPriceCheck } from "./StepPriceCheck";
import { StepNewItems } from "./StepNewItems";
import { StepSuppliers, StepCheck, StepComplete } from "./StepsEnd";

export function Wizard({ ticketId }: { ticketId?: string | undefined }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: opts, error } = useQuery({
    queryKey: ["wizard-options"],
    queryFn: () => wizardOptions(),
    staleTime: 60_000,
  });
  const [id, setId] = useState<string | null>(ticketId ?? null);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [draft, setDraftState] = useState<TicketDraft>(emptyDraft);
  const [loaded, setLoaded] = useState(!ticketId);
  const [busy, setBusy] = useState(false);
  const [pc, setPc] = useState<PriceCheckData | null>(null);
  const [resubmitOf, setResubmitOf] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    getDraft({ data: { id: ticketId } })
      .then((r) => {
        if (r.draft) setDraftState({ ...emptyDraft(), ...r.draft });
        setStep(r.step);
        setMaxStep(r.step);
        setResubmitOf(r.resubmitOf);
        setLoaded(true);
      })
      .catch((e) => {
        toast.error(errText(e));
        navigate({ to: "/item-registration" });
      });
  }, [ticketId, navigate]);

  const setDraft = (fn: (d: TicketDraft) => TicketDraft) => setDraftState((d) => fn(d));

  async function persist(nextStep: number, d = draft) {
    const r = await saveDraft({ data: { id, step: nextStep, draft: d as never } });
    if (!id) {
      setId(r.id);
      navigate({ to: "/item-registration/standard", search: { ticket: r.id }, replace: true });
    }
    void qc.invalidateQueries({ queryKey: ["my-tickets"] });
  }

  async function goTo(n: number) {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    window.scrollTo({ top: 0 });
  }

  async function next(updated?: TicketDraft) {
    const d = updated ?? draft;
    if (updated) setDraftState(updated);
    const hasNew = d.lines.some((l) => l.isNew);
    const n = step === 3 && !hasNew ? 5 : step + 1;
    setBusy(true);
    try {
      await persist(n, d);
      await goTo(n);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }
  function back() {
    const hasNew = draft.lines.some((l) => l.isNew);
    void goTo(step === 5 && !hasNew ? 3 : Math.max(1, step - 1));
  }

  async function discard() {
    if (!id) {
      navigate({ to: "/item-registration" });
      return;
    }
    if (!window.confirm("Delete this draft?")) return;
    try {
      await deleteDraft({ data: { id } });
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
      navigate({ to: "/item-registration" });
    } catch (e) {
      toast.error(errText(e));
    }
  }

  if (error) return <p className="text-sm text-destructive">{errText(error)}</p>;
  if (!opts || !loaded)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading...
      </div>
    );

  const props: StepProps = { draft, setDraft, opts, goTo: (n) => void goTo(n), next, back, busy };
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Register items: NMK brands"
        description={
          draft.brand
            ? `${draft.brand} · ${draft.entities.map((e) => e.code).join(", ") || "no entities yet"}${resubmitOf ? " · resubmission" : ""}`
            : "NMK Brand Portfolio"
        }
        actions={
          <Button variant="ghost" size="sm" onClick={discard}>
            <Trash2 />
            {id ? "Delete draft" : "Cancel"}
          </Button>
        }
      />
      <Stepper
        steps={STEPS}
        current={step - 1}
        onBack={(i) => i + 1 <= maxStep && void goTo(i + 1)}
      />
      {step === 1 && <StepBrand {...props} />}
      {step === 2 && <StepPrices {...props} />}
      {step === 3 && <StepPriceCheck {...props} pc={pc} setPc={setPc} />}
      {step === 4 && <StepNewItems {...props} pc={pc} />}
      {step === 5 && <StepSuppliers {...props} />}
      {step === 6 && <StepCheck {...props} pc={pc} />}
      {step === 7 && id && <StepComplete {...props} ticketId={id} save={() => persist(7)} />}
    </div>
  );
}
