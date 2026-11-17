import { useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ERP_HEADERS, type EntityReview } from "@/lib/buildTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SummaryStrip } from "@/components/SummaryStrip";
import { StatusBadge, type Status } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

// Presentation-only filters never alter the input rows or downloaded workbook.
export function BuildReview({ review, vendorCurrency, entityCurrency }: { review: EntityReview; vendorCurrency: string; entityCurrency: string }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const choose = (value: string) => { setFilter(value); setPage(0); };
  const errors = review.rows.filter(r => r.checks.some(c => c.level === "error")).length;
  const warnings = review.rows.filter(r => r.checks.some(c => c.level === "warning")).length;
  const duplicates = review.rows.filter(r => r.checks.some(c => c.message.includes("twice"))).length;
  const priceOnRequest = review.rows.filter(r => r.checks.some(c => c.message.startsWith("Price on request"))).length;
  const filtered = review.rows.filter(r => {
    const ok = filter === "All" || filter === "Items" || filter === "Errors" && r.checks.some(c => c.level === "error") || filter === "Warnings" && r.checks.some(c => c.level === "warning") || filter === "Duplicates" && r.checks.some(c => c.message.includes("twice")) || filter === "Price on request" && r.checks.some(c => c.message.startsWith("Price on request"));
    return ok && Object.values(r.columns).some(v => String(v ?? "").toLowerCase().includes(search.toLowerCase()));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 100));
  const activePage = Math.min(page, pages - 1);
  const numeric = new Set(["Cost Price", "Retail Price", "Max Discount", "Inactive", "Webactive", "B2B"]);
  const leading = ["Supplier", "Item Code", "Description", "Cost Price", "Retail Price", "Category Name"] as const;
  const headers = [...leading, ...ERP_HEADERS.filter(h => !leading.some(first => first === h))];
  return <div className="space-y-4">
    <SummaryStrip stats={[
      { label: "Items", value: review.rows.length, onClick: () => choose("All") },
      { label: "Duplicates", value: duplicates, tone: "warning", onClick: () => choose("Duplicates") },
      { label: "Exceptions", value: errors, tone: "error", onClick: () => choose("Errors") },
      { label: "Price on request", value: priceOnRequest, onClick: () => choose("Price on request") },
      { label: "Warnings", value: warnings, tone: "warning", onClick: () => choose("Warnings") },
      { label: "Errors", value: errors, tone: "error", onClick: () => choose("Errors") },
    ]} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1" aria-label="Filter rows">{["All", "Items", "Warnings", "Errors"].map(f => <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} aria-pressed={filter === f} onClick={() => choose(f)}>{f}</Button>)}</div><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="bg-card pl-9" aria-label="Search review rows" placeholder="Search item codes or descriptions" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div></div>
    <Table><TableHeader><TableRow>{headers.map(h => <TableHead key={h} className={cn("whitespace-nowrap", numeric.has(h) && "text-right")}>{h === "Cost Price" ? `Cost ${vendorCurrency}` : h === "Retail Price" ? `Retail ${entityCurrency}` : h}</TableHead>)}<TableHead>Status</TableHead><TableHead>price_basis</TableHead></TableRow></TableHeader><TableBody>{filtered.slice(activePage * 100, (activePage + 1) * 100).map(r => {
      const status: Status = r.checks.some(c => c.level === "error") ? "Error" : r.checks.some(c => c.message.startsWith("Price on request")) ? "Price on request" : r.checks.length ? "Warning" : "Ready";
      return <TableRow key={r.inputIndex}>{headers.map(h => <TableCell key={h} className={cn("min-w-32 max-w-80 break-words", h === "Item Code" && "font-semibold", numeric.has(h) && "text-right tabular-nums", h === "Supplier" && "text-muted-foreground")}>{typeof r.columns[h] === "number" && h === "Cost Price" ? Number(r.columns[h]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : r.columns[h]}</TableCell>)}<TableCell><StatusBadge status={status} message={r.checks.map(c => `${c.level}: ${c.message}`).join("; ")} /></TableCell><TableCell className="min-w-40">{r.price_basis}</TableCell></TableRow>;
    })}{!filtered.length && <TableRow><TableCell colSpan={22} className="h-32 text-center text-muted-foreground">No matching rows.</TableCell></TableRow>}</TableBody></Table>
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{filtered.length.toLocaleString()} rows · Page {activePage + 1} of {pages}</span><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Previous page" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}><ChevronLeft /></Button><Button size="icon" variant="outline" aria-label="Next page" disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}><ChevronRight /></Button></div></div>
  </div>;
}