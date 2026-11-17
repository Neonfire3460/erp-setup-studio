import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Stepper({ steps, current, onBack }: { steps: string[]; current: number; onBack?: (step: number) => void }) {
  return <nav aria-label="Progress" className="flex items-center rounded-lg border bg-card px-4 py-5 sm:px-6">{steps.map((label, i) => <div key={label} className={cn("flex min-w-0 items-center", i < steps.length - 1 && "flex-1")}>
    <Button variant="ghost" className="h-auto gap-2 p-0 hover:bg-transparent disabled:opacity-100 sm:gap-3" disabled={i >= current || !onBack} onClick={() => onBack?.(i)} aria-current={i === current ? "step" : undefined}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-xs", i < current ? "border-success bg-success text-success-foreground" : i === current ? "border-primary bg-primary text-primary-foreground ring-4 ring-accent" : "border-input text-muted-foreground")}>{i < current ? <Check className="size-4" /> : i + 1}</span>
      <span className={cn("hidden text-sm sm:block", i === current ? "font-bold text-foreground" : i < current ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </Button>{i < steps.length - 1 && <span className={cn("mx-3 h-px flex-1 sm:mx-5", i < current ? "bg-success" : "bg-border")} />}
  </div>)}</nav>;
}