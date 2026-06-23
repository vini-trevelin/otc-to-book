"use client";

import { Activity, ChevronRight, Minus, Plus } from "lucide-react";
import { type ReactNode, useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConnectionState, StreamStatus } from "@/lib/state";
import { cn } from "@/lib/utils";

export function WorkstationPanelHeader({
  title,
  status,
  statusHelp,
  streamStatus,
  action
}: {
  title: string;
  status?: string;
  statusHelp?: string | null;
  streamStatus?: StreamStatus;
  action?: ReactNode;
}) {
  const statusText = streamStatus?.message ?? status;
  const warning = streamStatus?.tone === "warning";

  return (
    <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xs font-semibold uppercase tracking-wide">{title}</h1>
          {statusText ? (
            <Badge className={cn(warning && "border-[var(--warning)] text-[var(--warning)]")} variant="outline">
              {statusText}
            </Badge>
          ) : null}
        </div>
        {statusHelp ? (
          <p role="status" className="mt-1 max-w-60 text-[11px] leading-snug text-[var(--warning)]">
            {statusHelp}
          </p>
        ) : null}
      </div>
      {action}
    </CardHeader>
  );
}

export function SidebarIndicator({
  ariaLabel,
  icon,
  status,
  onClick
}: {
  ariaLabel: string;
  icon: ReactNode;
  status: ConnectionState;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center">
      <Button
        aria-label={ariaLabel}
        className="relative size-10 rounded-md border border-[var(--border)] bg-[var(--panel)] text-[var(--muted-foreground)] hover:bg-[var(--panel-strong)] hover:text-foreground"
        onClick={onClick}
        title={`${ariaLabel}: ${status}`}
        type="button"
        variant="ghost"
      >
        {icon}
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[var(--muted-foreground)]" />
      </Button>
    </div>
  );
}

export function RightEdgeIndicator({ status, onClick }: { status: string; onClick: () => void }) {
  return (
    <div className="group fixed right-0 top-3 z-20 flex h-12 w-3 items-center justify-end">
      <Button
        aria-label="Expand parsed events"
        className="mr-1 size-9 translate-x-2 rounded-md border border-[var(--border)] bg-[var(--panel)] text-[var(--muted-foreground)] opacity-0 transition-[opacity,transform] duration-150 hover:bg-[var(--panel-strong)] hover:text-foreground group-hover:translate-x-0 group-hover:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100"
        onClick={onClick}
        title={`Expand parsed events: ${status}`}
        type="button"
        variant="ghost"
      >
        <Activity size={16} />
      </Button>
    </div>
  );
}

export function SidebarSection({
  title,
  description,
  open,
  onToggle,
  children
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--border)] pb-1.5 last:border-b-0 last:pb-0">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <SectionHeading description={description} title={title} />
        <Button
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          className="mt-0.5"
          onClick={onToggle}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronRight
            className={cn("transition-transform duration-150", open && "rotate-90")}
            size={14}
          />
        </Button>
      </div>
      {open ? <div className="mt-1.5">{children}</div> : null}
    </section>
  );
}

export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <Tooltip>
        <TooltipTrigger
          render={<h2 tabIndex={0} />}
          className="cursor-help text-xs font-semibold uppercase tracking-wide decoration-dotted underline-offset-4 hover:underline focus-visible:underline"
        >
          {title}
        </TooltipTrigger>
        <TooltipContent side="right">{description}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function FieldTooltip({
  label,
  description,
  htmlFor,
  children
}: {
  label: string;
  description: string;
  htmlFor?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <Tooltip>
        <TooltipTrigger
          render={<Label htmlFor={htmlFor} tabIndex={0} />}
          className="cursor-help text-xs decoration-dotted underline-offset-4 hover:underline focus-visible:underline"
        >
          {label}
        </TooltipTrigger>
        <TooltipContent side="right">{description}</TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
}

export function ConnectPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-[color-mix(in_oklch,var(--border),transparent_35%)] px-2.5 py-2">
      <div className="mb-2 text-xs text-[color-mix(in_oklch,var(--muted-foreground),transparent_18%)]">
        Live chat connectors will land here.
      </div>
      <div aria-hidden="true" className="space-y-1.5">
        <Skeleton className="h-3 w-3/4 bg-muted/25" />
        <Skeleton className="h-3 w-1/2 bg-muted/18" />
      </div>
    </div>
  );
}

export function EmptyWithSkeleton({
  text,
  className,
  children
}: {
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-[color-mix(in_oklch,var(--border),transparent_35%)] p-4 text-sm text-[color-mix(in_oklch,var(--muted-foreground),transparent_12%)]",
        className
      )}
    >
      <div>{text}</div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function NumberStepper({
  label,
  help,
  value,
  min,
  max,
  step,
  suffix,
  onChange
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const decimals = String(step).split(".")[1]?.length ?? 0;

  function clamp(next: number) {
    const bounded = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next));
    return Number(bounded.toFixed(decimals));
  }

  function update(next: number) {
    onChange(clamp(next));
  }

  return (
    <div>
      <FieldTooltip label={suffix ? `${label} (${suffix})` : label} description={help} htmlFor={id} />
      <div className="mt-1 grid grid-cols-[minmax(44px,1fr)_20px] gap-1">
        <Input
          aria-label={suffix ? `${label} (${suffix})` : label}
          className="h-8 bg-black px-1.5 text-center font-mono text-[11px]"
          id={id}
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          onBlur={() => update(value)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) update(next);
          }}
          value={value}
        />
        <div className="grid h-8 grid-rows-2 overflow-hidden rounded-md border border-[var(--border)]">
          <Button
            aria-label={`Increase ${label}`}
            className="h-4 rounded-none border-0 px-0"
            onClick={() => update(value + step)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Plus size={10} />
          </Button>
          <Button
            aria-label={`Decrease ${label}`}
            className="h-4 rounded-none border-0 border-t border-[var(--border)] px-0"
            onClick={() => update(value - step)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Minus size={10} />
          </Button>
        </div>
      </div>
    </div>
  );
}
