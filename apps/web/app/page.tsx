"use client";

import { Minus, Play, Plus, Send, Square } from "lucide-react";
import { FormEvent, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
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

  async function uploadSample(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${HTTP_URL}/samples/replay`, {
      method: "POST",
      body: formData
    });
    setUploadStatus(response.ok ? "Replay uploaded" : "Replay failed");
  }

  return (
    <main className="grid min-h-screen grid-cols-1 gap-3 overflow-x-hidden bg-background p-3 text-foreground lg:grid-cols-[minmax(300px,0.8fr)_minmax(460px,1.25fr)_minmax(320px,0.9fr)]">
      <Card className="gap-0 rounded-md bg-[var(--panel)] py-0">
        <PanelHeader title="Broker Chat" status={state.connection} />
        <form className="space-y-3 p-3" onSubmit={sendMessage}>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Input
              className="h-10 bg-black text-sm"
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
        </form>

        <Separator />
        <CardContent className="space-y-3 p-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Label className="block">
              Random
              <Slider
                className="mt-3"
                min={1}
                max={5}
                value={[randomness]}
                onValueChange={(value) =>
                  setRandomness(Array.isArray(value) ? (value[0] ?? 3) : value)
                }
              />
            </Label>
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
              value={intervalMs}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="gap-2 bg-emerald-500 text-black hover:bg-emerald-400"
              type="button"
              onClick={startSimulator}
              disabled={!isConnected}
            >
              <Play size={16} /> Start
            </Button>
            <Button
              className="gap-2 border-zinc-700 text-zinc-100 hover:bg-zinc-800"
              variant="outline"
              type="button"
              onClick={stopSimulator}
            >
              <Square size={16} /> Stop
            </Button>
          </div>
          <Label className="block text-xs text-[var(--muted-foreground)]">
            Replay JSON/CSV
            <Input
              className="mt-2 block w-full text-xs"
              type="file"
              accept=".csv,.json,.jsonl"
              onChange={(event) => void uploadSample(event.target.files?.[0] ?? null)}
            />
          </Label>
          {uploadStatus ? <p className="text-xs text-[var(--muted-foreground)]">{uploadStatus}</p> : null}
        </CardContent>

        <Separator />
        <div className="max-h-[48vh] overflow-auto p-3">
          {state.messages.length === 0 ? (
            <Empty text="No messages yet" />
          ) : (
            state.messages.map((item) => (
              <Card className="mb-3 gap-1 rounded-md py-2 text-sm" key={item.message_id}>
                <div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]">
                  <span>{item.broker_id}</span>
                  <span>{formatTime(item.received_timestamp)}</span>
                </div>
                <div>{item.text}</div>
              </Card>
            ))
          )}
        </div>
      </Card>

      <Card className="gap-0 rounded-md bg-[var(--panel)] py-0">
        <PanelHeader title="Consolidated Book" status={state.simulatorRunning ? "auto" : "manual"} />
        <CardContent className="space-y-4 p-3">
          {books.length === 0 ? <Empty text="Book empty" /> : null}
          {books.map((book) => (
            <Card className="gap-0 rounded-md py-0" key={book.instrument_id}>
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <div>
                  <div className="text-xs text-[var(--muted-foreground)]">Ticker</div>
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
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-md bg-[var(--panel)] py-0">
        <PanelHeader title="Parsed Events" status={`seq ${state.lastSequence}`} />
        <CardContent className="max-h-[88vh] overflow-auto p-3">
          {state.events.length === 0 ? <Empty text="No parsed events yet" /> : null}
          {state.events.map((event) => (
            <Card className="mb-3 gap-1 rounded-md py-2 text-xs" key={event.event_id}>
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
    </main>
  );
}

function PanelHeader({ title, status }: { title: string; status: string }) {
  return (
    <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] p-3">
      <h1 className="text-sm font-semibold uppercase tracking-wide">{title}</h1>
      <Badge variant="outline">{status}</Badge>
    </CardHeader>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card className="rounded-md border-dashed p-4 text-sm text-[var(--muted-foreground)]">
      {text}
    </Card>
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
      <div className="space-y-1">
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
        "grid grid-cols-[64px_48px_1fr_64px] items-center gap-2 rounded border border-[var(--border)] px-2 py-1 font-mono text-xs",
        ask ? "border-l-[var(--ask)]" : "border-l-[var(--bid)]",
        isActive
          ? "bg-[var(--panel-strong)] text-foreground"
          : "bg-transparent text-[var(--muted-foreground)] opacity-50"
      )}
      data-testid={`book-row-${row.status.toLowerCase()}`}
      title={row.status.toLowerCase()}
    >
      <span className={cn("font-semibold", ask ? "text-[var(--ask)]" : "text-[var(--bid)]")}>
        {row.quote_event.quote_value}
      </span>
      <span>
        {row.quote_event.quantity}
        {row.quote_event.quantity_unit.toLowerCase()}
      </span>
      <span className="truncate">{row.quote_event.broker_id}</span>
      <span className="text-right text-[var(--muted-foreground)]">
        {formatTime(row.quote_event.received_timestamp)}
      </span>
    </div>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number;
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
        {label}
      </Label>
      <div className="mt-1 grid grid-cols-[24px_1fr_24px] gap-1">
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
          aria-label={label}
          className="h-7 bg-black text-center font-mono"
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
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
