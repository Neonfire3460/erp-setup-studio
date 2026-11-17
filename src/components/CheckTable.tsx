import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { SummaryStrip } from "./SummaryStrip";
import { StatusBadge } from "./StatusBadge";
import type { Check } from "@/lib/workflow";
export type DisplayRow = {
  key: string;
  values: Record<string, string | number | null>;
  checks: Check[];
  change?: number | null;
};
export function CheckTable({ rows, columns }: { rows: DisplayRow[]; columns: string[] }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const error = rows.filter((r) => r.checks.some((c) => c.level === "error")).length,
    warning = rows.filter((r) => r.checks.some((c) => c.level === "warning")).length;
  const shown = rows.filter(
    (r) =>
      (filter === "All" ||
        (filter === "Errors" && r.checks.some((c) => c.level === "error")) ||
        (filter === "Warnings" && r.checks.some((c) => c.level === "warning")) ||
        (filter === "Price changes" &&
          r.change !== null &&
          r.change !== undefined &&
          r.change !== 0)) &&
      Object.values(r.values).join(" ").toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <SummaryStrip
        stats={[
          {
            label: "Rows",
            value: rows.length,
            onClick: () => {
              setFilter("All");
              setPage(0);
            },
          },
          {
            label: "Errors",
            value: error,
            tone: "error",
            onClick: () => {
              setFilter("Errors");
              setPage(0);
            },
          },
          {
            label: "Warnings",
            value: warning,
            tone: "warning",
            onClick: () => {
              setFilter("Warnings");
              setPage(0);
            },
          },
          {
            label: "Price on request",
            value: rows.filter((r) => r.checks.some((c) => c.code === "price_on_request")).length,
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {[
          "All",
          "Warnings",
          "Errors",
          ...(columns.includes("Change %") ? ["Price changes"] : []),
        ].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
          >
            {f}
          </Button>
        ))}
        <Input
          aria-label="Search rows"
          placeholder="Search item code or description"
          className="ml-auto w-full bg-card sm:w-72"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.slice(page * 100, (page + 1) * 100).map((r) => (
            <TableRow key={r.key}>
              {columns.map((c) => (
                <TableCell
                  key={c}
                  className={
                    typeof r.values[c] === "number"
                      ? "text-right tabular-nums"
                      : c === "Item Code"
                        ? "font-semibold"
                        : ""
                  }
                >
                  {r.values[c] ?? ""}
                </TableCell>
              ))}
              <TableCell>
                {r.checks.length ? (
                  r.checks.map((c, i) => (
                    <StatusBadge
                      key={`${c.code}-${i}`}
                      status={
                        c.level === "error"
                          ? "Error"
                          : c.code === "price_on_request"
                            ? "Price on request"
                            : "Warning"
                      }
                      message={c.message}
                    />
                  ))
                ) : (
                  <StatusBadge status="Ready" />
                )}
              </TableCell>
            </TableRow>
          ))}
          {!shown.length && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                No matching rows.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">
          {shown.length} rows · Page {page + 1} of {Math.max(1, Math.ceil(shown.length / 100))}
        </span>
        <Button variant="outline" size="sm" disabled={!page} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(page + 1) * 100 >= shown.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
