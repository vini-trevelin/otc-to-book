"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookRow, TickerBook } from "@/lib/events";
import { formatUtcTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function BookPanel({ books }: { books: TickerBook[] }) {
  return (
    <section className="min-h-0 min-w-0 overflow-auto">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(360px,1fr))] max-[430px]:[grid-template-columns:1fr]">
        {books.length === 0 ? <BookEmptyState /> : null}
        {books.map((book) => (
          <Card
            className="gap-0 rounded-md py-0"
            data-testid={`book-card-${book.instrument_id}`}
            key={book.instrument_id}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-strong)] p-3">
              <div>
                <div className="font-mono text-lg font-semibold">{book.instrument_id}</div>
              </div>
              <div className="text-right text-xs text-[var(--muted-foreground)]">
                updated {formatUtcTime(book.updated_timestamp)}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <BookSideColumn
                label="BID"
                rows={book.rows.filter((row) => row.quote_event.side === "BID")}
              />
              <BookSideColumn
                ask
                label="ASK"
                rows={book.rows.filter((row) => row.quote_event.side === "ASK")}
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function BookEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-[color-mix(in_oklch,var(--border),transparent_35%)] bg-[color-mix(in_oklch,var(--panel),transparent_25%)] p-4 text-sm text-[color-mix(in_oklch,var(--muted-foreground),transparent_12%)]">
      <div className="text-[color-mix(in_oklch,var(--foreground),transparent_12%)]">Book empty</div>
      <div className="mt-1 max-w-xl text-xs">
        Send a broker message or start simulation to build the book. The flow is raw message,
        parsed event, then active bid/ask row.
      </div>
      <div aria-hidden="true" className="mt-3 grid gap-3 sm:grid-cols-2">
        <BookCardSkeleton />
        <BookCardSkeleton />
      </div>
    </div>
  );
}

function BookCardSkeleton() {
  return (
    <div className="rounded-md border border-[color-mix(in_oklch,var(--border),transparent_45%)] bg-[color-mix(in_oklch,var(--panel-strong),transparent_35%)] p-3 opacity-75">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-20 bg-muted/25" />
        <Skeleton className="h-3 w-24 bg-muted/18" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-9 bg-[color-mix(in_oklch,var(--bid),transparent_84%)]" />
            <Skeleton className="h-3 w-5 bg-muted/18" />
          </div>
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--bid),transparent_93%)]" />
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--bid),transparent_95%)]" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-9 bg-[color-mix(in_oklch,var(--ask),transparent_84%)]" />
            <Skeleton className="h-3 w-5 bg-muted/18" />
          </div>
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--ask),transparent_93%)]" />
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--ask),transparent_95%)]" />
        </div>
      </div>
    </div>
  );
}

function BookSideColumn({
  label,
  rows,
  ask = false
}: {
  label: "BID" | "ASK";
  rows: BookRow[];
  ask?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "mb-2 flex items-center justify-between border-b border-[var(--border)] pb-1 text-xs font-semibold",
          ask ? "text-[var(--ask)]" : "text-[var(--bid)]"
        )}
      >
        <span>{label}</span>
        <span className="text-[var(--muted-foreground)]">{rows.length}</span>
      </div>
      <div className="max-h-[11.75rem] space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-[var(--border)] px-2 py-2 text-xs text-[var(--muted-foreground)]">
            No quotes
          </div>
        ) : (
          rows.map((row) => <BookQuoteRow ask={ask} key={row.row_id} row={row} />)
        )}
      </div>
    </div>
  );
}

function BookQuoteRow({ row, ask = false }: { row: BookRow; ask?: boolean }) {
  const isActive = row.status === "ACTIVE";

  return (
    <div
      className={cn(
        "grid min-h-10 gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-xs",
        ask
          ? "bg-[color-mix(in_oklch,var(--ask),transparent_90%)]"
          : "bg-[color-mix(in_oklch,var(--bid),transparent_90%)]",
        isActive
          ? "text-foreground"
          : "bg-transparent text-[var(--muted-foreground)] opacity-50"
      )}
      data-testid={`book-row-${row.status.toLowerCase()}`}
      title={`${row.status.toLowerCase()} | ${row.quote_event.broker_id} | ${formatUtcTime(
        row.quote_event.received_timestamp
      )}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className={cn("font-semibold", ask ? "text-[var(--ask)]" : "text-[var(--bid)]")}>
          {row.quote_event.quote_value}
        </span>
        <span className="text-right text-[var(--muted-foreground)]">
          {row.quote_event.quantity}
          {row.quote_event.quantity_unit.toLowerCase()}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        <span className="truncate">{row.quote_event.broker_id}</span>
        <span>{formatUtcTime(row.quote_event.received_timestamp)}</span>
      </div>
    </div>
  );
}
