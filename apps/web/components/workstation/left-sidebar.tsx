"use client";

import { ChevronLeft, MessageSquare, Play, RotateCcw, Send, Square, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import type { WorkstationController } from "@/lib/use-workstation";
import { formatUtcTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  ConnectPlaceholder,
  EmptyWithSkeleton,
  FieldTooltip,
  NumberStepper,
  SectionHeading,
  SidebarIndicator,
  SidebarSection,
  WorkstationPanelHeader
} from "./shared";

const SIMULATOR_HELP = {
  randomness:
    "Controls how varied the simulator is across brokers, tickers, sides, prices, and sizes. 1 is narrow; 5 is broad.",
  noise:
    "Probability that a simulator tick emits non-quote chat, such as greetings or flow checks.",
  step:
    "Delay between simulator messages. Lower values produce a faster tape.",
  chaos:
    "Probability of harder real-world message shapes used for parser evaluation.",
  tickerTypo:
    "Probability of ticker typo variants. These test alias and bounded fuzzy ticker resolution.",
  templateNoise:
    "Probability of extra words, spacing, or broker-style template noise around otherwise valid quotes."
} as const;

export function LeftSidebar({
  controller,
  open,
  onCollapse,
  onExpand
}: {
  controller: WorkstationController;
  open: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(true);
  const [insertOpen, setInsertOpen] = useState(true);
  const { state, isConnected } = controller;

  if (!open) {
    return (
      <aside className="min-h-0 min-w-0">
        <SidebarIndicator
          ariaLabel="Expand broker chat"
          icon={<MessageSquare size={16} />}
          onClick={onExpand}
          status={state.connection}
        />
      </aside>
    );
  }

  return (
    <aside className="min-h-0 min-w-0">
      <Card className="h-full min-h-0 gap-0 rounded-md bg-[var(--panel)] py-0">
        <WorkstationPanelHeader
          action={
            <Button
              aria-label="Collapse broker chat"
              onClick={onCollapse}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeft />
            </Button>
          }
          status={state.connection}
          statusHelp={
            isConnected ? null : "Backend stream unavailable. Check the API WebSocket and retry."
          }
          streamStatus={state.streamStatus}
          title="Broker Input"
        />

        <CardContent className="flex min-h-0 flex-1 flex-col space-y-1.5 overflow-hidden p-3">
          <SidebarSection
            description="Reserve space for real broker chat integrations."
            onToggle={() => setConnectOpen((value) => !value)}
            open={connectOpen}
            title="Connect"
          >
            <ConnectPlaceholder />
          </SidebarSection>

          <SidebarSection
            description="Generate broker flow with controlled noise."
            onToggle={() => setSimulateOpen((value) => !value)}
            open={simulateOpen}
            title="Simulate"
          >
            <SimulatorControls controller={controller} />
          </SidebarSection>

          <SidebarSection
            description="Insert manual messages or replay fixtures."
            onToggle={() => setInsertOpen((value) => !value)}
            open={insertOpen}
            title="Insert"
          >
            <ReplayAndMessageControls controller={controller} />
          </SidebarSection>

          <ChatFeed controller={controller} />

          <div className="flex flex-none items-center justify-between gap-2 pt-1">
            <div className="min-w-0 text-[11px] leading-snug text-[var(--muted-foreground)]">
              Stop simulation and reset all visible workstation state.
            </div>
            <Button
              aria-label="Clear all"
              className="gap-1.5"
              disabled={!isConnected}
              onClick={() => void controller.clearAll()}
              type="button"
              variant="outline"
            >
              <RotateCcw size={13} />
              Clear all
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function SimulatorControls({ controller }: { controller: WorkstationController }) {
  const { state, isConnected } = controller;

  return (
    <div className="space-y-2.5">
      <FieldTooltip label="Random" description={SIMULATOR_HELP.randomness}>
        <Slider
          className="mt-2"
          min={1}
          max={5}
          value={[controller.randomness]}
          onValueChange={(value) =>
            controller.setRandomness(Array.isArray(value) ? (value[0] ?? 3) : value)
          }
        />
      </FieldTooltip>
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper
          help={SIMULATOR_HELP.noise}
          label="Noise"
          max={1}
          min={0}
          onChange={controller.setNoiseRate}
          step={0.1}
          value={controller.noiseRate}
        />
        <NumberStepper
          help={SIMULATOR_HELP.step}
          label="Step"
          min={250}
          onChange={controller.setIntervalMs}
          step={250}
          suffix="ms"
          value={controller.intervalMs}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberStepper
          help={SIMULATOR_HELP.chaos}
          label="Chaos"
          max={1}
          min={0}
          onChange={controller.setChaosRate}
          step={0.1}
          value={controller.chaosRate}
        />
        <NumberStepper
          help={SIMULATOR_HELP.tickerTypo}
          label="Ticker typo"
          max={1}
          min={0}
          onChange={controller.setTickerTypoRate}
          step={0.1}
          value={controller.tickerTypoRate}
        />
        <NumberStepper
          help={SIMULATOR_HELP.templateNoise}
          label="Template noise"
          max={1}
          min={0}
          onChange={controller.setTemplateNoiseRate}
          step={0.1}
          value={controller.templateNoiseRate}
        />
      </div>
      <Button
        className={cn(
          "w-full gap-2",
          state.simulatorRunning
            ? "border-zinc-700 text-zinc-100 hover:bg-zinc-800"
            : "border border-[var(--border)] bg-[var(--panel-strong)] text-foreground hover:bg-zinc-800"
        )}
        type="button"
        onClick={controller.toggleSimulator}
        disabled={!isConnected}
        variant={state.simulatorRunning ? "outline" : "default"}
      >
        {state.simulatorRunning ? <Square size={16} /> : <Play size={16} />}
        {state.simulatorRunning ? "Stop simulation" : "Start simulation"}
      </Button>
    </div>
  );
}

function ReplayAndMessageControls({ controller }: { controller: WorkstationController }) {
  const replayInputId = "replay-fixture-input";
  const uploadDisabled = !controller.isConnected || controller.uploadingReplay;

  return (
    <form className="space-y-2" onSubmit={controller.submitUserMessage}>
      <div className="grid grid-cols-[1fr_104px] gap-2">
        <Input
          className="h-8 bg-black text-xs"
          value={controller.message}
          onChange={(event) => controller.setMessage(event.target.value)}
          aria-label="Message"
        />
        <NativeSelect
          className="w-full"
          value={controller.brokerId}
          onChange={(event) => controller.setBrokerId(event.target.value)}
          aria-label="Broker"
        >
          <NativeSelectOption>BROKER_A</NativeSelectOption>
          <NativeSelectOption>BROKER_B</NativeSelectOption>
          <NativeSelectOption>BROKER_C</NativeSelectOption>
        </NativeSelect>
      </div>
      <Button className="gap-2" type="submit" variant="secondary" disabled={!controller.isConnected}>
        <Send size={16} /> Send
      </Button>
      <div className="space-y-1.5">
        <Label
          className={cn(
            "inline-flex h-7 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-strong)] px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-zinc-800",
            uploadDisabled && "pointer-events-none cursor-not-allowed opacity-50"
          )}
          htmlFor={replayInputId}
          aria-disabled={uploadDisabled}
        >
          <Upload size={13} />
          Replay fixture
        </Label>
        <Input
          id={replayInputId}
          className="sr-only"
          type="file"
          accept=".csv,.json,.jsonl"
          disabled={uploadDisabled}
          onChange={(event) => {
            void controller.uploadReplay(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {controller.uploadingReplay ? (
        <p className="text-xs text-[var(--muted-foreground)]">Uploading replay...</p>
      ) : null}
      {controller.uploadStatus ? (
        <p className="text-xs text-[var(--muted-foreground)]">{controller.uploadStatus}</p>
      ) : null}
      {controller.uploadError ? (
        <p role="alert" className="text-xs text-[var(--warning)]">
          {controller.uploadError}
        </p>
      ) : null}
    </form>
  );
}

function ChatFeed({ controller }: { controller: WorkstationController }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border-b border-[var(--border)] pb-1.5">
      <SectionHeading description="Latest accepted raw messages." title="Chat" />
      <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
        {controller.state.messages.length === 0 ? (
          <EmptyWithSkeleton
            className="h-full"
            text="No raw messages yet. Send or simulate broker flow to populate this feed."
          >
            <div aria-hidden="true" className="space-y-2">
              <Skeleton className="h-3 w-24 bg-muted/30" />
              <Skeleton className="h-4 w-full bg-muted/20" />
              <Skeleton className="h-3 w-20 bg-muted/25" />
              <Skeleton className="h-4 w-4/5 bg-muted/15" />
            </div>
          </EmptyWithSkeleton>
        ) : (
          controller.state.messages.map((item) => (
            <div
              className="mb-1.5 rounded-md border border-[var(--border)] bg-[color-mix(in_oklch,var(--panel-strong),transparent_18%)] px-2 py-1.5"
              key={item.message_id}
            >
              <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2 font-mono text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                <span className="truncate">{item.broker_id}</span>
                <span>{formatUtcTime(item.received_timestamp)}</span>
              </div>
              <div className="break-words text-xs leading-snug text-foreground">{item.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
