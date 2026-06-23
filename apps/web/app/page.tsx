"use client";

import { useState } from "react";

import { BookPanel } from "@/components/workstation/book-panel";
import { EventPanel } from "@/components/workstation/event-panel";
import { LeftSidebar } from "@/components/workstation/left-sidebar";
import { RightEdgeIndicator } from "@/components/workstation/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWorkstation } from "@/lib/use-workstation";
import { cn } from "@/lib/utils";

export default function WorkstationPage() {
  const controller = useWorkstation();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <TooltipProvider>
      <main
        className={cn(
          "relative grid h-screen min-h-0 grid-cols-1 gap-3 overflow-hidden bg-background p-3 text-foreground transition-[grid-template-columns] duration-200 ease-out lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]",
          !leftOpen && "lg:grid-cols-[44px_minmax(0,1fr)]",
          rightOpen &&
            "lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(320px,380px)]",
          !leftOpen && rightOpen && "lg:grid-cols-[44px_minmax(0,1fr)_minmax(320px,380px)]"
        )}
      >
        <LeftSidebar
          controller={controller}
          onCollapse={() => setLeftOpen(false)}
          onExpand={() => setLeftOpen(true)}
          open={leftOpen}
        />

        <BookPanel books={controller.books} />

        {rightOpen ? (
          <EventPanel
            events={controller.state.events}
            lastSequence={controller.state.lastSequence}
            onCollapse={() => setRightOpen(false)}
          />
        ) : (
          <RightEdgeIndicator
            onClick={() => setRightOpen(true)}
            status={`seq ${controller.state.lastSequence}`}
          />
        )}
      </main>
    </TooltipProvider>
  );
}
