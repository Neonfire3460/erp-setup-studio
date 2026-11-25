// Deadline display shared by the admin pages: week colours and the "Needed by" strip on a ticket.
import { CalendarCheck, CalendarClock } from "lucide-react";
import { dueText, fmtDay, weekGroup, type WeekGroup } from "@/lib/nmk/dates";
import { cn } from "@/lib/utils";

export const GROUP_STYLE: Record<WeekGroup, string> = {
  overdue: "bg-destructive text-white",
  this_week: "bg-warning text-white",
  next_week: "bg-primary text-primary-foreground",
  later: "bg-muted text-foreground",
  no_date: "bg-muted text-muted-foreground",
};

/** Big, clear "Needed by" and "In effect from" at the top of a ticket. */
export function DeadlineStrip({
  neededBy,
  effectiveFrom,
}: {
  neededBy: string | null | undefined;
  effectiveFrom: string | null | undefined;
}) {
  if (!neededBy && !effectiveFrom) return null;
  const g = weekGroup(neededBy);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {neededBy && (
        <div className={cn("flex items-center gap-3 rounded-[10px] p-4 shadow-sm", GROUP_STYLE[g])}>
          <CalendarClock className="size-7 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80">
              Needed by
            </p>
            <p className="text-lg font-bold">
              {fmtDay(neededBy)} · {dueText(neededBy)}
            </p>
          </div>
        </div>
      )}
      {effectiveFrom && (
        <div className="flex items-center gap-3 rounded-[10px] border bg-card p-4 shadow-sm">
          <CalendarCheck className="size-7 shrink-0 text-primary" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Prices in effect from
            </p>
            <p className="text-lg font-bold">{fmtDay(effectiveFrom)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
