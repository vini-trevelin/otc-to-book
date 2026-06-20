"use client";

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Minus,
  Play,
  Plus,
  Send,
  Square
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BookRow, ClientEvent } from "@/lib/events";
import { initialState, workstationReducer } from "@/lib/state";
import { cn } from "@/lib/utils";

const WS_URL = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://127.0.0.1:8000/ws";
const HTTP_URL = process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://127.0.0.1:8000";

export default function WorkstationPage() {
  const [state, dispatch] = useReducer(workstationReducer, initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const [message, setMessage] = useState("vendo petro27 7.30 5mm");
  const [brokerId, setBrokerId] = useState("BROKER_A");
  const [randomness, setRandomness] = useState(3);
  const [noiseRate, setNoiseRate] = useState(0.2);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(true);
  const [insertOpen, setInsertOpen] = useState(true);

  useEffect(() => {
    dispatch({ type: "connection", connection: "connecting" });
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.addEventListener("open", () => dispatch({ type: "connection", connection: "connected" }));
    socket.addEventListener("close", () =>
      dispatch({ type: "connection", connection: "disconnected" })
    );
    socket.addEventListener("message", (event) => {
      dispatch({ type: "server_event", event: JSON.parse(event.data) });
    });

    return () => socket.close();
  }, []);

  const books = useMemo(() => Object.values(state.book?.books ?? {}), [state.book]);
  const isConnected = state.connection === "connected";

  function sendClientEvent(event: ClientEvent) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    sendClientEvent({
      event_type: "user_message",
      payload: { broker_id: brokerId, text: message.trim() }
    });
  }

  function startSimulator() {
    dispatch({ type: "simulator", running: true });
    sendClientEvent({
      event_type: "simulator_start",
      payload: { randomness, noise_rate: noiseRate, interval_ms: intervalMs }
    });
  }

  function stopSimulator() {
    dispatch({ type: "simulator", running: false });
    sendClientEvent({ event_type: "simulator_stop", payload: {} });
  }

  function toggleSimulator() {
    if (state.simulatorRunning) {
      stopSimulator();
    } else {
      startSimulator();
    }
  }

  async function uploadSample(file: File | null) {
    if (!file) return;
    setUploadStatus("");
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${HTTP_URL}/samples/replay`, {
        method: "POST",
        body: formData
      });
      if (response.ok) {
        setUploadStatus("Replay uploaded");
        return;
      }
      setUploadError("Replay failed. Check file type/schema, then retry.");
    } catch {
      setUploadError("Replay failed. API unavailable; verify backend on port 8000.");
    }
  }

  return (
    <TooltipProvider>
      <main
        className={cn(
          "relative grid min-h-screen grid-cols-1 gap-3 overflow-x-hidden bg-background p-3 text-foreground transition-[grid-template-columns] duration-200 ease-out lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]",
          !leftOpen && "lg:grid-cols-[44px_minmax(0,1fr)]",
          rightOpen &&
            "lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(320px,380px)]",
          !leftOpen && rightOpen && "lg:grid-cols-[44px_minmax(0,1fr)_minmax(320px,380px)]"
        )}
      >
      <aside className="min-w-0">
        {leftOpen ? (
          <Card className="h-full gap-0 rounded-md bg-[var(--panel)] py-0">
            <PanelHeader
              action={
                <Button
                  aria-label="Collapse broker chat"
                  onClick={() => setLeftOpen(false)}
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
              title="Broker Input"
            />

            <CardContent className="flex min-h-0 flex-1 flex-col space-y-1.5 p-3">
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
                <div className="space-y-2.5">
                  <Label className="block text-xs">
                    Random
                    <Slider
                      className="mt-2"
                      min={1}
                      max={5}
                      value={[randomness]}
                      onValueChange={(value) =>
                        setRandomness(Array.isArray(value) ? (value[0] ?? 3) : value)
                      }
                    />
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberStepper
                      label="Noise"
                      max={1}
                      min={0}
                      onChange={setNoiseRate}
                      step={0.1}
                      value={noiseRate}
                    />
                    <NumberStepper
                      label="Step"
                      min={250}
                      onChange={setIntervalMs}
                      step={250}
                      suffix="ms"
                      value={intervalMs}
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
                    onClick={toggleSimulator}
                    disabled={!isConnected}
                    variant={state.simulatorRunning ? "outline" : "default"}
                  >
                    {state.simulatorRunning ? <Square size={16} /> : <Play size={16} />}
                    {state.simulatorRunning ? "Stop simulation" : "Start simulation"}
                  </Button>
                </div>
              </SidebarSection>

              <SidebarSection
                description="Insert manual messages or replay fixtures."
                onToggle={() => setInsertOpen((value) => !value)}
                open={insertOpen}
                title="Insert"
              >
                <form className="space-y-2" onSubmit={sendMessage}>
                  <div className="grid grid-cols-[1fr_104px] gap-2">
                    <Input
                      className="h-8 bg-black text-xs"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      aria-label="Message"
                    />
                    <NativeSelect
                      className="w-full"
                      value={brokerId}
                      onChange={(event) => setBrokerId(event.target.value)}
                      aria-label="Broker"
                    >
                      <NativeSelectOption>BROKER_A</NativeSelectOption>
                      <NativeSelectOption>BROKER_B</NativeSelectOption>
                      <NativeSelectOption>BROKER_C</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <Button className="gap-2" type="submit" variant="secondary" disabled={!isConnected}>
                    <Send size={16} /> Send
                  </Button>
                  <Label className="block text-[11px] text-[var(--muted-foreground)]">
                    Replay fixture
                    <Input
                      className="mt-1.5 block h-7 w-full text-[11px]"
                      type="file"
                      accept=".csv,.json,.jsonl"
                      onChange={(event) => void uploadSample(event.target.files?.[0] ?? null)}
                    />
                  </Label>
                  {uploadStatus ? (
                    <p className="text-xs text-[var(--muted-foreground)]">{uploadStatus}</p>
                  ) : null}
                  {uploadError ? (
                    <p role="alert" className="text-xs text-[var(--warning)]">
                      {uploadError}
                    </p>
                  ) : null}
                </form>
              </SidebarSection>

              <div className="flex min-h-0 flex-1 flex-col">
                <SectionHeading
                  description="Latest accepted raw messages."
                  title="Chat"
                />
                <div className="mt-2 min-h-0 flex-1 overflow-auto">
                  {state.messages.length === 0 ? (
                    <EmptyWithSkeleton
                      className="h-full min-h-28"
                      text="No raw messages yet. Send or simulate broker flow to populate this feed."
                    >
                      <div aria-hidden="true" className="space-y-2">
                        <Skeleton className="h-3 w-24 bg-muted/55" />
                        <Skeleton className="h-4 w-full bg-muted/40" />
                        <Skeleton className="h-3 w-20 bg-muted/45" />
                        <Skeleton className="h-4 w-4/5 bg-muted/35" />
                      </div>
                    </EmptyWithSkeleton>
                  ) : (
                    state.messages.map((item) => (
                      <Card className="mb-2 gap-1 rounded-md py-2 text-sm" key={item.message_id}>
                        <div className="mb-1 flex justify-between gap-2 text-xs text-[var(--muted-foreground)]">
                          <span>{item.broker_id}</span>
                          <span>{formatTime(item.received_timestamp)}</span>
                        </div>
                        <div>{item.text}</div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <SidebarIndicator
            ariaLabel="Expand broker chat"
            icon={<MessageSquare size={16} />}
            onClick={() => setLeftOpen(true)}
            status={state.connection}
          />
        )}
      </aside>

      <section className="min-w-0">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(360px,1fr))] max-[430px]:[grid-template-columns:1fr]">
          {books.length === 0 ? <BookEmptyState /> : null}
          {books.map((book) => (
            <Card className="gap-0 rounded-md py-0" key={book.instrument_id}>
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <div>
                  <div className="font-mono text-lg font-semibold">{book.instrument_id}</div>
                </div>
                <div className="text-right text-xs text-[var(--muted-foreground)]">
                  updated {formatTime(book.updated_timestamp)}
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

      {rightOpen ? (
        <aside className="min-w-0">
          <Card className="h-full gap-0 rounded-md bg-[var(--panel)] py-0">
            <PanelHeader
              action={
                <Button
                  aria-label="Collapse parsed events"
                  onClick={() => setRightOpen(false)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronRight />
                </Button>
              }
              status={`seq ${state.lastSequence}`}
              title="Parsed Events"
            />
            <CardContent className="max-h-[88vh] overflow-auto p-3">
              {state.events.length === 0 ? (
                <EmptyWithSkeleton text="No parsed events yet. Open this feed after sending or simulating messages to inspect extraction output.">
                  <div aria-hidden="true" className="space-y-2">
                    <Skeleton className="h-3 w-28 bg-muted/55" />
                    <Skeleton className="h-3 w-full bg-muted/35" />
                    <Skeleton className="h-3 w-4/5 bg-muted/35" />
                  </div>
                </EmptyWithSkeleton>
              ) : null}
              {state.events.map((event) => (
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
      ) : (
        <RightEdgeIndicator onClick={() => setRightOpen(true)} status={`seq ${state.lastSequence}`} />
      )}
      </main>
    </TooltipProvider>
  );
}

function PanelHeader({
  title,
  status,
  statusHelp,
  action
}: {
  title: string;
  status: string;
  statusHelp?: string | null;
  action?: ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
      <div>
        <h1 className="text-xs font-semibold uppercase tracking-wide">{title}</h1>
        <Badge className="mt-1" variant="outline">
          {status}
        </Badge>
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

function SidebarIndicator({
  ariaLabel,
  icon,
  status,
  onClick
}: {
  ariaLabel: string;
  icon: ReactNode;
  status: string;
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

function RightEdgeIndicator({ status, onClick }: { status: string; onClick: () => void }) {
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

function SidebarSection({
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

function SectionHeading({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <Tooltip>
        <TooltipTrigger
          render={<h2 />}
          className="cursor-help text-xs font-semibold uppercase tracking-wide decoration-dotted underline-offset-4 hover:underline focus-visible:underline"
        >
          {title}
        </TooltipTrigger>
        <TooltipContent side="right">{description}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ConnectPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] px-2.5 py-2">
      <div className="mb-2 text-xs text-[var(--muted-foreground)]">
        Live chat connectors will land here.
      </div>
      <div aria-hidden="true" className="space-y-1.5">
        <Skeleton className="h-3 w-3/4 bg-muted/60" />
        <Skeleton className="h-3 w-1/2 bg-muted/45" />
      </div>
    </div>
  );
}

function EmptyWithSkeleton({
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
        "rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]",
        className
      )}
    >
      <div>{text}</div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function BookEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--panel)] p-4 text-sm text-[var(--muted-foreground)]">
      <div className="text-foreground">Book empty</div>
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
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel-strong)] p-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-20 bg-muted/70" />
        <Skeleton className="h-3 w-24 bg-muted/45" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-9 bg-[color-mix(in_oklch,var(--bid),transparent_72%)]" />
            <Skeleton className="h-3 w-5 bg-muted/45" />
          </div>
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--bid),transparent_86%)]" />
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--bid),transparent_91%)]" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-9 bg-[color-mix(in_oklch,var(--ask),transparent_72%)]" />
            <Skeleton className="h-3 w-5 bg-muted/45" />
          </div>
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--ask),transparent_86%)]" />
          <Skeleton className="h-9 w-full bg-[color-mix(in_oklch,var(--ask),transparent_91%)]" />
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
      title={`${row.status.toLowerCase()} | ${row.quote_event.broker_id} | ${formatTime(
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
        <span>{formatTime(row.quote_event.received_timestamp)}</span>
      </div>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange
}: {
  label: string;
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
      <Label className="block" htmlFor={id}>
        {suffix ? `${label} (${suffix})` : label}
      </Label>
      <div className="mt-1 grid grid-cols-[22px_minmax(38px,1fr)_22px] gap-1">
        <Button
          aria-label={`Decrease ${label}`}
          className="h-7 px-0"
          onClick={() => update(value - step)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Minus size={12} />
        </Button>
        <Input
          aria-label={suffix ? `${label} (${suffix})` : label}
          className="h-7 bg-black px-1 text-center font-mono text-[11px]"
          id={id}
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          onBlur={() => update(value)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) update(next);
          }}
          value={value}
        />
        <Button
          aria-label={`Increase ${label}`}
          className="h-7 px-0"
          onClick={() => update(value + step)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus size={12} />
        </Button>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
