import { useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { adminQuery, samplesQuery } from "@/lib/workflow.queries";
import { previewTicketFn, resolveTicket } from "@/lib/submissions.functions";
import { ticketSchema, type TicketDraft } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export function TicketsPage() {
  const { data } = useSuspenseQuery(adminQuery);
  const [id, setId] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <h1 className="nmk-page-heading">Tickets</h1>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Kind",
              "Brand",
              "Sub activity",
              "Entity",
              "Cost currency",
              "Rows affected",
              "Submission",
              "User",
              "",
            ].map((h, i) => (
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.tickets.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.kind.replaceAll("_", " ")}</TableCell>
              <TableCell>{t.brand_activity}</TableCell>
              <TableCell>{t.sub_activity ?? "All"}</TableCell>
              <TableCell>
                {t.entity_code} ({data.entities.find((e) => e.code === t.entity_code)?.currency})
              </TableCell>
              <TableCell>{t.currency ?? "—"}</TableCell>
              <TableCell className="text-right">{t.row_count}</TableCell>
              <TableCell>{t.submission_id?.slice(0, 8)}</TableCell>
              <TableCell>
                {
                  data.users.find(
                    (u) =>
                      u.user_id === data.submissions.find((s) => s.id === t.submission_id)?.user_id,
                  )?.email
                }
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => setId(t.id)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!data.tickets.length && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No open tickets.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {id && <TicketEditor key={id} id={id} close={() => setId(null)} />}
    </div>
  );
}
function TicketEditor({ id, close }: { id: string; close: () => void }) {
  const { data } = useSuspenseQuery(adminQuery);
  const t = data.tickets.find((t) => t.id === id);
  const { data: samples, error } = useQuery(samplesQuery(id));
  const [draft, setDraft] = useState<TicketDraft>(ticketSchema.parse({ id }));
  const [divisors, setDivisors] = useState("0.75");
  const [preview, setPreview] = useState<{ code: string; retail: string; checks: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const previewFn = useServerFn(previewTicketFn);
  const resolve = useServerFn(resolveTicket);
  const qc = useQueryClient();
  if (!t) return null;
  function payload() {
    return ticketSchema.parse({
      ...draft,
      divisors: divisors
        .split(/[\s,÷]+/)
        .filter(Boolean)
        .map(Number),
    });
  }
  async function run(save: boolean) {
    setBusy(true);
    try {
      const d = payload();
      if (save) {
        const r = await resolve({ data: d });
        await qc.invalidateQueries();
        if (r.failures.length)
          toast.error(`Saved, but ${r.failures.length} submissions need recalculation`);
        else {
          toast.success("Saved and calculated");
          close();
        }
      } else {
        const rows = await previewFn({ data: d });
        setPreview(
          rows.map((r) => ({
            code: String(r.values["Item Code"]),
            retail: String(r.values["Retail Price"] ?? "Pending"),
            checks: r.checks.map((c) => c.message).join("; "),
          })),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save ticket");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {t.kind.replaceAll("_", " ")} · {t.brand_activity}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{t.note}</p>
          <Label className="text-muted-foreground">
            <Lock className="size-3" />
            Admin only
          </Label>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cost {t.currency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples?.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>{s.item_code}</TableCell>
                  <TableCell>{s.description}</TableCell>
                  <TableCell className="text-right">{s.cost_price}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {error && <p className="text-destructive">Could not load samples.</p>}
          {t.kind === "pricing_rule" ? (
            <>
              <div className="space-y-2">
                <Label>Applies to</Label>
                <Select
                  value={draft.allSubs ? "all" : "sub"}
                  onValueChange={(v) => setDraft({ ...draft, allSubs: v === "all" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sub">
                      This sub activity: {t.sub_activity ?? "All"}
                    </SelectItem>
                    <SelectItem value="all">All sub activities of {t.brand_activity}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Overhead %</Label>
                  <Input
                    type="number"
                    value={draft.overhead}
                    onChange={(e) => setDraft({ ...draft, overhead: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Round up to</Label>
                  <Select
                    value={String(draft.round)}
                    onValueChange={(v) => setDraft({ ...draft, round: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 10, 100, 1000].map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r} · ROUNDUP {r === 1 ? "0" : `-${Math.log10(r)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Margin divisors</Label>
                <Input value={divisors} onChange={(e) => setDivisors(e.target.value)} />
                <p className="text-sm text-muted-foreground">
                  {divisors
                    .split(/[\s,÷]+/)
                    .filter(Boolean)
                    .map((d) => `÷ ${d}`)
                    .join(" ")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Max discount % (optional)</Label>
                <Input
                  type="number"
                  value={draft.maxDiscount ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      maxDiscount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={draft.compare}
                  onCheckedChange={(v) => setDraft({ ...draft, compare: v === true })}
                />
                Compare with vendor MSRP
              </Label>
              <Button variant="outline" disabled={busy} onClick={() => void run(false)}>
                Preview
              </Button>
              {preview.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Retail</TableHead>
                      <TableHead>Checks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.code}</TableCell>
                        <TableCell className="text-right">{p.retail}</TableCell>
                        <TableCell>{p.checks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : t.kind === "exchange_rate" ? (
            <div className="space-y-2">
              <Label>
                1 {t.currency} = ? {data.entities.find((e) => e.code === t.entity_code)?.currency}
              </Label>
              <Input
                type="number"
                step="any"
                value={draft.rate}
                onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Supplier code · {t.entity_code}</Label>
              <Input
                value={draft.supplier}
                onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
              />
            </div>
          )}
        </div>
        <SheetFooter>
          <Button disabled={busy} onClick={() => void run(true)}>
            {busy ? "Calculating…" : "Save and calculate"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
