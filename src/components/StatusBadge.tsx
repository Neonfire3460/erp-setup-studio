import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
export type Status = "Ready" | "Warning" | "Error" | "Price on request" | "Duplicate" | "Category" | "Skipped";
export function StatusBadge({ status, message }: { status: Status; message?: string }) {
  const badge = <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap border-transparent", status === "Ready" ? "bg-success-soft text-success" : status === "Warning" ? "bg-warning-soft text-warning" : status === "Error" ? "bg-destructive-soft text-destructive" : status === "Price on request" ? "bg-accent text-primary" : "bg-muted text-muted-foreground")}><span className="size-1.5 rounded-full bg-current" />{status}</Badge>;
  return message ? <TooltipProvider><Tooltip><TooltipTrigger asChild><span tabIndex={0} className="inline-flex">{badge}</span></TooltipTrigger><TooltipContent className="max-w-80">{message}</TooltipContent></Tooltip></TooltipProvider> : badge;
}