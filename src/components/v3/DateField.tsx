// A big date button that opens a calendar. Days before `min` can't be picked.
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDay, isoDate, parseIso } from "@/lib/nmk/dates";
import { cn } from "@/lib/utils";

export function DateField({
  label,
  value,
  min,
  onChange,
  error,
  clearable,
}: {
  label: string;
  value: string | undefined;
  min: Date;
  onChange: (v: string | undefined) => void;
  error?: string | null;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-11 w-full justify-start text-left text-base",
                !value && "text-muted-foreground",
                error && "border-destructive",
              )}
            >
              <CalendarDays className="text-primary" />
              {value ? fmtDay(value) + " " + parseIso(value).getFullYear() : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ? parseIso(value) : undefined}
              defaultMonth={value ? parseIso(value) : min}
              disabled={{ before: min }}
              onSelect={(d) => {
                if (d) onChange(isoDate(d));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {clearable && value && (
          <Button variant="ghost" className="h-11" onClick={() => onChange(undefined)}>
            Clear
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
