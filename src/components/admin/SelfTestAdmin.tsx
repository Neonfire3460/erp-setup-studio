import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runPricingSelfTest, type SelfTestLine } from "@/lib/selfTest.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SelfTestAdmin() {
  const run = useServerFn(runPricingSelfTest);
  const [lines, setLines] = useState<SelfTestLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      setLines(await run());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Self-test failed");
    }
    setBusy(false);
  }

  const passed = lines?.filter((l) => l.pass).length ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button onClick={go} disabled={busy}>{busy ? "Running..." : "Pricing self-test"}</Button>
        {lines && <span className="text-sm">{passed} of {lines.length} passed</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
      {lines && (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Case (rule · vendor price · entity)</TableHead><TableHead>Result</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.label}</TableCell>
                <TableCell>{l.pass ? <Badge>Pass</Badge> : <Badge variant="destructive">Fail</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
