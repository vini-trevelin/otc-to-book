"use client";

import { Play, Send, Square } from "lucide-react";
import { FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";

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
    <main className="grid min-h-screen grid-cols-1 gap-3 p-3 lg:grid-cols-[360px_1fr_380px]">
      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)]">
        <PanelHeader title="Broker Chat" status={state.connection} />
        <form className="space-y-3 border-b border-[var(--border)] p-3" onSubmit={sendMessage}>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <input
              className="rounded border border-[var(--border)] bg-black px-3 py-2 text-sm"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-label="Message"
            />
            <select
              className="rounded border border-[var(--border)] bg-black px-2 text-sm"
              value={brokerId}
              onChange={(event) => setBrokerId(event.target.value)}
              aria-label="Broker"
            >
              <option>BROKER_A</option>
              <option>BROKER_B</option>
              <option>BROKER_C</option>
            </select>
          </div>
          <button className="inline-flex items-center gap-2 rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950">
            <Send size={16} /> Send
          </button>
        </form>

        <div className="space-y-3 border-b border-[var(--border)] p-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label>
              Random
              <input
                className="mt-1 w-full"
                type="range"
                min="1"
                max="5"
                value={randomness}
                onChange={(event) => setRandomness(Number(event.target.value))}
              />
            </label>
            <label>
              Noise
              <input
                className="mt-1 w-full"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={noiseRate}
                onChange={(event) => setNoiseRate(Number(event.target.value))}
              />
            </label>
            <label>
              MS
              <input
                className="mt-1 w-full rounded border border-[var(--border)] bg-black px-2 py-1"
                type="number"
                min="250"
                value={intervalMs}
                onChange={(event) => setIntervalMs(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-black"
              type="button"
              onClick={startSimulator}
            >
              <Play size={16} /> Start
            </button>
            <button
              className="inline-flex items-center gap-2 rounded bg-zinc-800 px-3 py-2 text-sm"
              type="button"
              onClick={stopSimulator}
            >
              <Square size={16} /> Stop
            </button>
          </div>
          <label className="block text-xs text-[var(--muted-foreground)]">
            Replay JSON/CSV
            <input
              className="mt-2 block w-full text-xs"
              type="file"
              accept=".csv,.json,.jsonl"
              onChange={(event) => void uploadSample(event.target.files?.[0] ?? null)}
            />
          </label>
          {uploadStatus ? <p className="text-xs text-[var(--muted-foreground)]">{uploadStatus}</p> : null}
        </div>

        <div className="max-h-[48vh] overflow-auto p-3">
          {state.messages.length === 0 ? (
            <Empty text="No messages yet" />
          ) : (
            state.messages.map((item) => (
              <div className="mb-3 rounded border border-[var(--border)] p-2 text-sm" key={item.message_id}>
                <div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]">
                  <span>{item.broker_id}</span>
                  <span>{formatTime(item.received_timestamp)}</span>
                </div>
                <div>{item.text}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)]">
        <PanelHeader title="Consolidated Book" status={state.simulatorRunning ? "auto" : "manual"} />
        <div className="space-y-4 p-3">
          {books.length === 0 ? <Empty text="Book empty" /> : null}
          {books.map((book) => (
            <div className="rounded border border-[var(--border)]" key={book.instrument_id}>
              <div className="grid grid-cols-2 border-b border-[var(--border)] bg-[var(--panel-strong)] p-3">
                <Best label="BEST BID" row={book.best_bid} />
                <Best label="BEST ASK" row={book.best_ask} ask />
              </div>
              <table className="w-full border-collapse text-sm">
                <thead className="text-left text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="p-2">Side</th>
                    <th className="p-2">Price</th>
                    <th className="p-2">Size</th>
                    <th className="p-2">Broker</th>
                    <th className="p-2">Received</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {book.rows.map((row) => (
                    <tr
                      className={cn(
                        "border-t border-[var(--border)]",
                        row.status === "SUPERSEDED" && "text-[var(--muted-foreground)] opacity-55"
                      )}
                      data-testid={`book-row-${row.status.toLowerCase()}`}
                      key={row.row_id}
                    >
                      <td className="p-2">{row.quote_event.side}</td>
                      <td className="p-2">{row.quote_event.quote_value}</td>
                      <td className="p-2">
                        {row.quote_event.quantity}
                        {row.quote_event.quantity_unit.toLowerCase()}
                      </td>
                      <td className="p-2">{row.quote_event.broker_id}</td>
                      <td className="p-2">{formatTime(row.quote_event.received_timestamp)}</td>
                      <td className="p-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--panel)]">
        <PanelHeader title="Parsed Events" status={`seq ${state.lastSequence}`} />
        <div className="max-h-[88vh] overflow-auto p-3">
          {state.events.length === 0 ? <Empty text="No parsed events yet" /> : null}
          {state.events.map((event) => (
            <div className="mb-3 rounded border border-[var(--border)] p-2 text-xs" key={event.event_id}>
              <div className="mb-1 flex justify-between">
                <span className="font-semibold">{event.event_type}</span>
                <span className="text-[var(--muted-foreground)]">#{event.sequence}</span>
              </div>
              <div className="text-[var(--muted-foreground)]">corr {event.correlation_id}</div>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px]">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function PanelHeader({ title, status }: { title: string; status: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] p-3">
      <h1 className="text-sm font-semibold uppercase tracking-wide">{title}</h1>
      <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200">{status}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">{text}</div>;
}

function Best({ label, row, ask = false }: { label: string; row: BookRow | null; ask?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className={cn("text-2xl font-bold", ask ? "text-[var(--ask)]" : "text-[var(--bid)]")}>
        {row ? row.quote_event.quote_value : "-"}
      </div>
      <div className="text-xs text-[var(--muted-foreground)]">
        {row ? `${row.quote_event.quantity}${row.quote_event.quantity_unit.toLowerCase()} ${row.quote_event.broker_id}` : "No active quote"}
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
