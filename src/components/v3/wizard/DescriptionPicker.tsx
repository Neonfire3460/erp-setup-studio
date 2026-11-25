// Step 3: descriptions that differ from the ERP. For each code pick ERP (default), Vendor, or the AI's
// recommendation, and edit any of them. The AI uses both wordings and the brand's style, and learns from
// what people keep (saved when the ticket is submitted).
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label11, Card, errText } from "@/components/v3/ui";
import { aiDescribe } from "@/lib/v3/aiItems.functions";
import { codeKey } from "@/lib/nmk/util";
import type { TicketDraft, TicketLine } from "@/lib/nmk/types";
import { cn } from "@/lib/utils";

type Diff = { itemCode: string; erpDescription: string; vendorDescription: string };
type Choice = "erp" | "vendor" | "custom";

const choiceOf = (l: TicketLine): Choice =>
  !l.useVendorDescription
    ? "erp"
    : l.vendorDescription !== undefined && l.description !== l.vendorDescription
      ? "custom"
      : "vendor";

export function DescriptionPicker({
  diffs,
  draft,
  setDraft,
}: {
  diffs: Diff[];
  draft: TicketDraft;
  setDraft: (f: (d: TicketDraft) => TicketDraft) => void;
}) {
  const [working, setWorking] = useState(false);
  const byCode = new Map(draft.lines.map((l) => [codeKey(l.itemCode), l]));
  const patch = (codes: string[], f: (l: TicketLine, d: Diff) => Partial<TicketLine>) => {
    const want = new Map(diffs.map((d) => [codeKey(d.itemCode), d]));
    const set = new Set(codes.map(codeKey));
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => {
        const k = codeKey(l.itemCode);
        const x = want.get(k);
        return set.has(k) && x ? { ...l, ...f(l, x) } : l;
      }),
    }));
  };
  const pick = (codes: string[], c: Choice) =>
    patch(codes, (l, x) => {
      const vendor = l.vendorDescription ?? x.vendorDescription;
      if (c === "erp")
        return { useVendorDescription: false, description: vendor, vendorDescription: vendor };
      if (c === "vendor")
        return { useVendorDescription: true, description: vendor, vendorDescription: vendor };
      return {
        useVendorDescription: true,
        vendorDescription: vendor,
        description:
          l.aiDescription || (l.description !== vendor ? l.description : x.erpDescription),
      };
    });
  const withAi = diffs.filter((d) => byCode.get(codeKey(d.itemCode))?.aiDescription);

  async function runAi() {
    setWorking(true);
    try {
      let got = 0;
      let warn: string | null = null;
      for (let i = 0; i < diffs.length; i += 60) {
        const part = diffs.slice(i, i + 60);
        const r = await aiDescribe({
          data: {
            brand: draft.brand,
            region: draft.region,
            items: part.map((d) => ({
              lineNo: byCode.get(codeKey(d.itemCode))?.lineNo ?? 0,
              itemCode: d.itemCode,
              vendor: d.vendorDescription,
              erp: d.erpDescription,
            })),
          },
        });
        warn = r.warning ?? warn;
        const m = new Map(r.items.map((x) => [x.lineNo, x.description]));
        got += m.size;
        setDraft((d) => ({
          ...d,
          lines: d.lines.map((l) =>
            m.has(l.lineNo) ? { ...l, aiDescription: m.get(l.lineNo)! } : l,
          ),
        }));
        if (warn) break;
      }
      if (warn) toast.warning(warn);
      if (got)
        toast.success(
          `${got} AI-recommended description${got === 1 ? "" : "s"} ready. Pick "AI" to use one, and edit it if you like.`,
        );
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Label11>Descriptions that differ from the ERP ({diffs.length})</Label11>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The ERP description stays unless you pick another. The AI writes one from both wordings
            in this brand's ERP style, and learns from what you keep.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void runAi()}
            disabled={working}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md hover:from-violet-500 hover:to-fuchsia-500"
          >
            {working ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {withAi.length ? "Write them again" : "Write AI-recommended descriptions"}
          </Button>
          {withAi.length > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                pick(
                  withAi.map((d) => d.itemCode),
                  "custom",
                )
              }
            >
              Use AI for all {withAi.length}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              pick(
                diffs.map((d) => d.itemCode),
                "erp",
              )
            }
          >
            Keep ERP for all
          </Button>
        </div>
      </div>
      <div className="max-h-[560px] divide-y overflow-auto rounded-lg border">
        {diffs.map((x) => {
          const l = byCode.get(codeKey(x.itemCode));
          if (!l) return null;
          const c = choiceOf(l);
          const opt = (k: Choice, label: string, body: string, extra?: string) => (
            <button
              type="button"
              onClick={() => pick([x.itemCode], k)}
              disabled={k === "custom" && !l.aiDescription && c !== "custom"}
              className={cn(
                "rounded-lg border p-2 text-left text-[13px] transition disabled:opacity-40",
                c === k
                  ? "border-primary bg-accent ring-1 ring-primary"
                  : "hover:border-primary/50",
                extra,
              )}
            >
              <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                {k === "custom" && <Sparkles className="size-3 text-violet-600" />}
                {label}
              </span>
              {body || <span className="text-muted-foreground">Press the AI button first</span>}
            </button>
          );
          return (
            <div key={x.itemCode} className="space-y-2 p-3">
              <p className="text-sm font-semibold">{x.itemCode}</p>
              <div className="grid gap-2 md:grid-cols-3">
                {opt("erp", "ERP (now)", x.erpDescription)}
                {opt("vendor", "Vendor", x.vendorDescription)}
                {opt(
                  "custom",
                  c === "custom" && l.description !== l.aiDescription ? "Yours" : "AI recommended",
                  c === "custom" ? l.description : (l.aiDescription ?? ""),
                  "border-violet-300/60",
                )}
              </div>
              {c === "custom" && (
                <Textarea
                  rows={2}
                  value={l.description}
                  onChange={(e) => patch([x.itemCode], () => ({ description: e.target.value }))}
                  className="text-[13px]"
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
