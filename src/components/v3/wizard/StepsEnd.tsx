// Step 5 (supplier per entity), Step 6 (missing data check) and Step 7 (special instructions, Complete).
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, Label11, errText } from "@/components/v3/ui";
import { submitTicket, supplierInfo } from "@/lib/v3/wizard.functions";
import { checkDraft, ticketLines, type MissingField } from "@/lib/nmk/ticket";
import type { SupplierAnswer } from "@/lib/nmk/types";
import { brandOf, type PriceCheckData, type StepProps } from "./shared";

export function StepSuppliers({ draft, setDraft, opts, next, back, busy }: StepProps) {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const codes = draft.entities.map((e) => e.code);
    if (
      draft.suppliers.length === codes.length &&
      draft.suppliers.every((s) => codes.includes(s.entityCode))
    )
      return;
    setLoading(true);
    supplierInfo({ data: { brand: draft.brand, entities: codes } })
      .then((list) =>
        setDraft((d) => ({
          ...d,
          suppliers: list.map((s) => ({
            ...s,
            answer: d.suppliers.find((x) => x.entityCode === s.entityCode)?.answer ?? null,
          })),
        })),
      )
      .catch((e) => toast.error(errText(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (code: string, patch: Partial<SupplierAnswer>) =>
    setDraft((d) => ({
      ...d,
      suppliers: d.suppliers.map((s) => (s.entityCode === code ? { ...s, ...patch } : s)),
    }));
  const name = (code: string) => opts.entities.find((e) => e.code === code)?.name ?? code;
  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading suppliers...
      </div>
    );
  const done = draft.suppliers.every(
    (s) => s.answer === "correct" || (s.answer === "different" && s.newName?.trim()),
  );
  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <Label11>Confirm the supplier for each entity</Label11>
        {draft.suppliers.map((s) => (
          <div key={s.entityCode} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
            <p className="text-sm">
              {s.supplierCode ? (
                <>
                  Is <b>{s.supplierName || "this supplier"}</b> ({s.supplierCode}) correct for{" "}
                  <b>{name(s.entityCode)}</b>?
                </>
              ) : (
                <>
                  There's no supplier on file for {draft.brand} in <b>{name(s.entityCode)}</b>. Type
                  the supplier name.
                </>
              )}
            </p>
            <RadioGroup
              className="flex gap-6"
              value={s.answer ?? ""}
              onValueChange={(v) => set(s.entityCode, { answer: v as "correct" | "different" })}
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="correct" disabled={!s.supplierCode} />
                Correct
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="different" />
                Different
              </label>
            </RadioGroup>
            {s.answer === "different" && (
              <div className="grid max-w-xl gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Supplier name (required)"
                  value={s.newName ?? ""}
                  onChange={(e) => set(s.entityCode, { newName: e.target.value })}
                />
                <Input
                  placeholder="Supplier code, if you know it"
                  value={s.newCode ?? ""}
                  onChange={(e) => set(s.entityCode, { newCode: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
        <Button disabled={!done || busy} onClick={() => next()}>
          Continue to Check
        </Button>
      </div>
    </div>
  );
}

function useMissing({ draft, opts }: Pick<StepProps, "draft" | "opts">) {
  const brand = brandOf(opts, draft.brand);
  return checkDraft(draft, {
    units: opts.units.map((u) => u.code),
    ...(brand?.sub_activities.length ? { subActivities: brand.sub_activities } : {}),
  });
}

function MissingList({ missing, goTo }: { missing: MissingField[]; goTo: (n: number) => void }) {
  return (
    <ul className="max-h-96 space-y-1 overflow-auto">
      {missing.map((m, i) => (
        <li
          key={i}
          className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-muted"
        >
          <span>{m.message}</span>
          <Button
            size="sm"
            variant="link"
            onClick={() => {
              goTo(m.step);
              if (m.lineNo)
                setTimeout(
                  () =>
                    document
                      .getElementById(`line-${m.lineNo}`)
                      ?.scrollIntoView({ block: "center" }),
                  300,
                );
            }}
          >
            Go to step {m.step}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function StepCheck({
  draft,
  opts,
  goTo,
  next,
  back,
  busy,
  pc,
}: StepProps & { pc: PriceCheckData | null }) {
  const missing = useMissing({ draft, opts });
  const big =
    pc?.result.perEntity.reduce((a, e) => a + e.rows.filter((r) => r.check).length, 0) ?? 0;
  const gone = pc?.result.missing.length ?? 0;
  return (
    <div className="space-y-5">
      {missing.length ? (
        <Card className="space-y-3 border-destructive/30">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-5" />
            We can't submit this yet: {missing.length} thing{missing.length === 1 ? " is" : "s are"}{" "}
            missing
          </p>
          <MissingList missing={missing} goTo={goTo} />
        </Card>
      ) : (
        <Card className="flex items-center gap-3 border-success/30 bg-success-soft">
          <CheckCircle2 className="size-5 text-success" />
          <p className="text-sm font-semibold text-success">Nothing is missing.</p>
        </Card>
      )}
      {(big > 0 || gone > 0) && (
        <Card className="space-y-1 border-warning/30 bg-warning-soft text-sm text-warning">
          {big > 0 && (
            <p>
              {big} price change{big === 1 ? "" : "s"} over ±{pc?.result.warnPct ?? 10}%. Check they
              use the right price column and unit.
            </p>
          )}
          {gone > 0 && (
            <p>
              {gone} item{gone === 1 ? " is" : "s are"} in the ERP but not in this list.
            </p>
          )}
          <p className="text-xs">These don't stop you submitting.</p>
        </Card>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Back
        </Button>
        <Button disabled={missing.length > 0 || busy} onClick={() => next()}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export function StepComplete({
  draft,
  setDraft,
  opts,
  goTo,
  back,
  ticketId,
  save,
}: StepProps & { ticketId: string; save: () => Promise<void> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [popup, setPopup] = useState<MissingField[] | null>(null);
  const missing = useMissing({ draft, opts });
  const lines = ticketLines(draft);
  const name = (code: string) => opts.entities.find((e) => e.code === code)?.name ?? code;
  const changed = draft.suppliers.filter((s) => s.answer === "different");

  async function complete() {
    if (missing.length) {
      setPopup(missing);
      return;
    }
    setSending(true);
    try {
      await save();
      const r = await submitTicket({
        data: { id: ticketId, specialInstructions: draft.specialInstructions ?? "" },
      });
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
      toast.success(`Submitted as ${r.ticketNo}`);
      navigate({ to: "/my-submissions/$id", params: { id: r.id } });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-2">
        <Label11>Anything the admin should know?</Label11>
        <Textarea
          rows={4}
          placeholder='Optional, for example "Use new prices from 1 Dec"'
          value={draft.specialInstructions ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, specialInstructions: e.target.value }))}
        />
      </Card>
      <Card className="space-y-2 text-sm">
        <Label11>Summary</Label11>
        <p>
          <span className="text-muted-foreground">Brand:</span> <b>{draft.brand}</b>
        </p>
        <p>
          <span className="text-muted-foreground">Entities:</span>{" "}
          {draft.entities.map((e) => `${name(e.code)} (cost in ${e.costCurrency})`).join(", ")}
        </p>
        <p>
          <span className="text-muted-foreground">Items:</span>{" "}
          {lines.filter((l) => !l.isNew).length} existing, {lines.filter((l) => l.isNew).length} new
          {draft.lines.filter((l) => l.isNew && !l.include).length
            ? `, ${draft.lines.filter((l) => l.isNew && !l.include).length} new codes left out`
            : ""}
        </p>
        <p>
          <span className="text-muted-foreground">Supplier changes:</span>{" "}
          {changed.length ? changed.map((s) => `${s.entityCode}: ${s.newName}`).join(", ") : "none"}
        </p>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={sending}>
          Back
        </Button>
        <Button onClick={complete} disabled={sending}>
          {sending ? "Submitting..." : "Complete"}
        </Button>
      </div>
      <Dialog open={!!popup} onOpenChange={(o) => !o && setPopup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              We can't submit this yet: {popup?.length} thing{popup?.length === 1 ? " is" : "s are"}{" "}
              missing
            </DialogTitle>
            <DialogDescription>Fill these in, then press Complete again.</DialogDescription>
          </DialogHeader>
          <MissingList
            missing={popup ?? []}
            goTo={(n) => {
              setPopup(null);
              goTo(n);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
