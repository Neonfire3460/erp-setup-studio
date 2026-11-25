// PriceCharts: Step 3 visuals. A summary strip (direction bar + average) and a diverging column chart of
// how many items moved by how much. Plain elements and CSS, no chart library.
import { ArrowDownRight, ArrowUpRight, Equal, PackagePlus } from "lucide-react";
import { fmtPct } from "@/components/v3/ui";
import { cn } from "@/lib/utils";

type Band = { label: string; count: number };
type Tiles = {
  compared: number;
  up: number;
  down: number;
  unchanged: number;
  avgPct: number | null;
  medianPct: number | null;
};

// Decreases teal, no change slate, increases indigo getting darker as the rise grows.
const BAND_COLOR = ["#0E7C7B", "#2CC5C2", "#94A3B8", "#A5B4FC", "#7C6CF5", "#5B4CF0", "#3B2FD9"];

export function PriceSummary({
  tiles: t,
  newCodes,
  toCheck,
  warnPct,
}: {
  tiles: Tiles;
  newCodes: number;
  toCheck: number;
  warnPct: number;
}) {
  const total = Math.max(1, t.down + t.unchanged + t.up + newCodes);
  const parts = [
    { label: "Went down", n: t.down, color: "#1FB7B5", icon: ArrowDownRight },
    { label: "Unchanged", n: t.unchanged, color: "#94A3B8", icon: Equal },
    { label: "Went up", n: t.up, color: "#5B4CF0", icon: ArrowUpRight },
    { label: "New codes", n: newCodes, color: "#C026D3", icon: PackagePlus },
  ];
  const avg = t.avgPct ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1460] p-6 text-white">
        <div aria-hidden="true" className="nmk-hero-glow pointer-events-none absolute inset-0" />
        <div className="relative space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C7CCF5]">
            Average cost change
          </p>
          <p
            className={cn(
              "text-5xl font-extrabold tabular-nums tracking-[-0.03em]",
              avg > 0 ? "text-white" : avg < 0 ? "text-[#7DE3E1]" : "text-white",
            )}
          >
            {fmtPct(t.avgPct) || "-"}
          </p>
          <p className="text-sm text-[#D9DEFF]">
            Median {fmtPct(t.medianPct) || "-"} · {t.compared} item{t.compared === 1 ? "" : "s"}{" "}
            compared
          </p>
          {toCheck > 0 && (
            <p className="mt-3 inline-flex rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
              {toCheck} moved more than ±{warnPct}%: worth a check
            </p>
          )}
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Where every code landed
        </p>
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-muted">
          {parts
            .filter((p) => p.n > 0)
            .map((p) => (
              <div
                key={p.label}
                title={`${p.label}: ${p.n}`}
                className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(p.n / total) * 100}%`, background: p.color }}
              />
            ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {parts.map((p) => (
            <div key={p.label} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ background: p.color }}
              >
                <p.icon className="size-4" />
              </span>
              <span>
                <span className="block text-xl font-extrabold leading-none tabular-nums">
                  {p.n}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{p.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MoveChart({ bands, title }: { bands: Band[]; title: string }) {
  const max = Math.max(1, ...bands.map((b) => b.count));
  const total = Math.max(
    1,
    bands.reduce((a, b) => a + b.count, 0),
  );
  const zero = bands.findIndex((b) => b.label === "0%");
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </p>
        <span className="flex gap-4 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#2CC5C2]" /> Cheaper
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#94A3B8]" /> Same
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#5B4CF0]" /> Dearer
          </span>
        </span>
      </div>
      <div className="relative">
        <div
          className="grid h-56 items-end gap-2 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))` }}
        >
          {bands.map((b, i) => {
            const h = b.count ? Math.max(6, (b.count / max) * 100) : 0;
            return (
              <div
                key={b.label}
                className={cn(
                  "group relative flex h-full flex-col items-center justify-end rounded-xl",
                  i === zero && "bg-muted/60",
                )}
                title={`${b.label}: ${b.count} item${b.count === 1 ? "" : "s"} (${Math.round((b.count / total) * 100)}%)`}
              >
                <span
                  className={cn(
                    "mb-1.5 text-sm font-extrabold tabular-nums",
                    b.count ? "text-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {b.count}
                </span>
                <div
                  className="w-full max-w-[72px] rounded-t-lg transition-all duration-500 group-hover:brightness-110"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(180deg, ${BAND_COLOR[i] ?? "#5B4CF0"}, ${BAND_COLOR[i] ?? "#5B4CF0"}cc)`,
                    boxShadow: b.count ? `0 8px 18px ${BAND_COLOR[i] ?? "#5B4CF0"}40` : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="h-px w-full bg-border" />
        <div
          className="mt-2 grid gap-2 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))` }}
        >
          {bands.map((b, i) => (
            <span
              key={b.label}
              className={cn(
                "text-center text-[11px] font-semibold leading-tight text-muted-foreground sm:text-xs",
                i === zero && "text-foreground",
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A thin bar showing how big a change is next to the % in the top-10 tables. */
export function PctBar({ pct, max }: { pct: number | null; max: number }) {
  if (pct === null) return null;
  const w = Math.min(100, (Math.abs(pct) / Math.max(1, max)) * 100);
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-muted align-middle">
      <span
        className="block h-full rounded-full"
        style={{ width: `${w}%`, background: pct < 0 ? "#1FB7B5" : "#5B4CF0" }}
      />
    </span>
  );
}
