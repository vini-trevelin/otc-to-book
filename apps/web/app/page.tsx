"use client";

import { Play, Send, Square } from "lucide-react";
import { FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
            <Label className="block">
              Noise
              <Input
                className="mt-1"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={noiseRate}
                onChange={(event) => setNoiseRate(Number(event.target.value))}
              />
            </Label>
            <Label className="block">
              MS
              <Input
                className="mt-1 bg-black"
                type="number"
                min="250"
                value={intervalMs}
                onChange={(event) => setIntervalMs(Number(event.target.value))}
              />
            </Label>
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
              <div className="grid grid-cols-2 border-b border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <Best label="BEST BID" row={book.best_bid} />
                <Best label="BEST ASK" row={book.best_ask} ask />
              </div>
              <Table>
                <TableHeader className="text-xs uppercase text-[var(--muted-foreground)]">
                  <TableRow>
                    <TableHead>Side</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Broker</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {book.rows.map((row) => (
                    <TableRow
                      className={cn(
                        row.status === "SUPERSEDED" && "text-[var(--muted-foreground)] opacity-55"
                      )}
                      data-testid={`book-row-${row.status.toLowerCase()}`}
                      key={row.row_id}
                    >
                      <TableCell>{row.quote_event.side}</TableCell>
                      <TableCell>{row.quote_event.quote_value}</TableCell>
                      <TableCell>
                        {row.quote_event.quantity}
                        {row.quote_event.quantity_unit.toLowerCase()}
                      </TableCell>
                      <TableCell>{row.quote_event.broker_id}</TableCell>
                      <TableCell>{formatTime(row.quote_event.received_timestamp)}</TableCell>
                      <TableCell>{row.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

function Best({ label, row, ask = false }: { label: string; row: BookRow | null; ask?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className={cn("text-2xl font-bold", ask ? "text-[var(--ask)]" : "text-[var(--bid)]")}>
        {row ? row.quote_event.quote_value : "-"}
      </div>
      <div className="text-xs text-[var(--muted-foreground)]">
        {row
          ? `${row.quote_event.quantity}${row.quote_event.quantity_unit.toLowerCase()} ${row.quote_event.broker_id}`
          : "No active quote"}
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
