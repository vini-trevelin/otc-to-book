"use client";

import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventEnvelope } from "@/lib/events";
import { EmptyWithSkeleton, WorkstationPanelHeader } from "./shared";

export function EventPanel({
  events,
  lastSequence,
  onCollapse
}: {
  events: EventEnvelope[];
  lastSequence: number;
  onCollapse: () => void;
}) {
  return (
    <aside className="min-h-0 min-w-0">
      <Card className="h-full gap-0 rounded-md bg-[var(--panel)] py-0">
        <WorkstationPanelHeader
          action={
            <Button
              aria-label="Collapse parsed events"
              onClick={onCollapse}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronRight />
            </Button>
          }
          status={`seq ${lastSequence}`}
          title="Parsed Events"
        />
        <CardContent className="max-h-[88vh] overflow-auto p-3">
          {events.length === 0 ? (
            <EmptyWithSkeleton text="No parsed events yet. Open this feed after sending or simulating messages to inspect extraction output.">
              <div aria-hidden="true" className="space-y-2">
                <Skeleton className="h-3 w-28 bg-muted/30" />
                <Skeleton className="h-3 w-full bg-muted/18" />
                <Skeleton className="h-3 w-4/5 bg-muted/18" />
              </div>
            </EmptyWithSkeleton>
          ) : null}
          {events.map((event) => (
            <Card className="mb-2 gap-1 rounded-md py-2 text-xs" key={event.event_id}>
              <div className="mb-1 flex justify-between">
                <span className="font-semibold">{event.event_type}</span>
                <span className="text-[var(--muted-foreground)]">#{event.sequence}</span>
              </div>
              <div className="text-[var(--muted-foreground)]">corr {event.correlation_id}</div>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[11px] text-zinc-300">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </Card>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
