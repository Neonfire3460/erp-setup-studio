// Small shared pieces for the v3 pages (DESIGN.md look).
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type TicketStatus } from "@/lib/nmk/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="nmk-page-heading">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Label11({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Tile({
  title,
  subtitle,
  icon: Icon,
  live,
  onClick,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  live: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-h-40 flex-col items-start justify-between rounded-[10px] border bg-card p-6 text-left transition-colors",
        live ? "hover:border-primary hover:bg-accent/40" : "opacity-80 hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          live ? "bg-accent text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </span>
      <span className="mt-6 block">
        <span className="block text-base font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm text-muted-foreground">{subtitle}</span>}
      </span>
      {!live && (
        <Badge
          variant="outline"
          className="absolute right-4 top-4 border-transparent bg-muted text-muted-foreground"
        >
          Coming soon
        </Badge>
      )}
    </button>
  );
}

const STATUS_TONE: Record<TicketStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-accent text-primary",
  in_review: "bg-accent text-primary",
  awaiting_approval: "bg-accent text-primary",
  on_hold: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  rejected: "bg-destructive-soft text-destructive",
  uploaded: "bg-success-soft text-success",
  verified: "bg-success-soft text-success",
};
export function TicketStatusBadge({ status }: { status: string }) {
  const s = (status in STATUS_LABEL ? status : "draft") as TicketStatus;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap border-transparent", STATUS_TONE[s])}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[s]}
    </Badge>
  );
}

export function Empty({
  icon: Icon,
  text,
  action,
}: {
  icon: LucideIcon;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border bg-card p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="size-6" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[10px] border bg-card p-5", className)}>{children}</div>;
}

export function AdminOnly() {
  return (
    <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      <Lock className="size-3" />
      Admin only
    </span>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "warning" | "error" | "success" | undefined;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border bg-card px-4 py-3",
        tone === "warning" && "border-warning/20 bg-warning-soft",
        tone === "error" && "border-destructive/20 bg-destructive-soft",
        tone === "success" && "border-success/20 bg-success-soft",
      )}
    >
      <p
        className={cn(
          "text-[22px] font-bold tabular-nums",
          tone === "error"
            ? "text-destructive"
            : tone === "warning"
              ? "text-warning"
              : tone === "success"
                ? "text-success"
                : "",
        )}
      >
        {value}
      </p>
      <Label11>{label}</Label11>
    </div>
  );
}

/** A dialog that asks for text (Reject reason, Hold comments). */
export function TextDialog({
  open,
  title,
  description,
  placeholder,
  required,
  confirm,
  destructive,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  confirm: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setText("");
          setErr("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr("");
          }}
          placeholder={placeholder}
          rows={4}
          autoFocus
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              if (required && text.trim().length < 3) {
                setErr(placeholder ?? "Please type a comment");
                return;
              }
              setBusy(true);
              try {
                await onConfirm(text.trim());
                setText("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working..." : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirm,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirm: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working..." : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
export const fmtNum = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || Number.isNaN(n)
    ? ""
    : n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
export const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
export const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
export const waiting = (s: string | null | undefined) => {
  if (!s) return "";
  const h = (Date.now() - new Date(s).getTime()) / 36e5;
  return h < 1
    ? `${Math.max(1, Math.round(h * 60))} min`
    : h < 48
      ? `${Math.round(h)} h`
      : `${Math.round(h / 24)} days`;
};
