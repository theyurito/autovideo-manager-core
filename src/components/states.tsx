import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Loader({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-2 py-10 text-muted-foreground", className)}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{label ?? "Carregando..."}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Algo deu errado",
  description,
  onRetry,
  retryLabel = "Tentar novamente",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
