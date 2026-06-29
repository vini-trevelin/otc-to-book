"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import type { BookStatePayload, ClientEvent, EventEnvelope } from "@/lib/events";
import { isClientErrorPayload, isEventEnvelope, isValidServerEventPayload } from "@/lib/events";
import { initialState, workstationReducer } from "@/lib/state";

const WS_URL = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://127.0.0.1:8000/ws";
const HTTP_URL = process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://127.0.0.1:8000";

const CLEAR_TIMEOUT_MS = 2000;
const DEFAULT_MESSAGE = "vendo petro27 7.30 5mm";
const DEFAULT_BROKER_ID = "BROKER_A";
const DEFAULT_RANDOMNESS = 3;
const DEFAULT_NOISE_RATE = 0.2;
const DEFAULT_CHAOS_RATE = 0;
const DEFAULT_TICKER_TYPO_RATE = 0;
const DEFAULT_TEMPLATE_NOISE_RATE = 0;
const DEFAULT_INTERVAL_MS = 1000;

type ClearResolver = {
  resolve: () => void;
  timer: number;
};

type ReplayResponse = {
  replay_id: string;
  events: unknown[];
  rejected_rows?: number;
};

type ReplayErrorResponse = {
  detail?: unknown;
};

export function useWorkstation() {
  const [state, dispatch] = useReducer(workstationReducer, initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const clearResolverRef = useRef<ClearResolver | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [brokerId, setBrokerId] = useState(DEFAULT_BROKER_ID);
  const [randomness, setRandomness] = useState(DEFAULT_RANDOMNESS);
  const [noiseRate, setNoiseRate] = useState(DEFAULT_NOISE_RATE);
  const [chaosRate, setChaosRate] = useState(DEFAULT_CHAOS_RATE);
  const [tickerTypoRate, setTickerTypoRate] = useState(DEFAULT_TICKER_TYPO_RATE);
  const [templateNoiseRate, setTemplateNoiseRate] = useState(DEFAULT_TEMPLATE_NOISE_RATE);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadingReplay, setUploadingReplay] = useState(false);

  const handleServerEvent = useCallback((event: EventEnvelope) => {
    if (event.event_type === "client_error" && isClientErrorPayload(event.payload)) {
      toast.warning(event.payload.message);
    }

    dispatch({ type: "server_event", event });

    if (
      event.event_type === "book_updated" &&
      isEmptyBookPayload(event.payload) &&
      clearResolverRef.current
    ) {
      window.clearTimeout(clearResolverRef.current.timer);
      clearResolverRef.current.resolve();
      clearResolverRef.current = null;
    }
  }, []);

  const handleUnknownServerEvent = useCallback((messageText: string) => {
    dispatch({
      type: "stream_status",
      status: { tone: "warning", message: messageText }
    });
    toast.warning(messageText);
  }, []);

  useEffect(() => {
    dispatch({ type: "connection", connection: "connecting" });
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.addEventListener("open", () => dispatch({ type: "connection", connection: "connected" }));
    socket.addEventListener("close", () =>
      dispatch({ type: "connection", connection: "disconnected" })
    );
    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (!isEventEnvelope(parsed) || !isValidServerEventPayload(parsed)) {
          handleUnknownServerEvent("Ignored malformed server event");
          return;
        }
        handleServerEvent(parsed);
      } catch {
        handleUnknownServerEvent("Ignored malformed server event");
      }
    });

    return () => {
      if (clearResolverRef.current) {
        window.clearTimeout(clearResolverRef.current.timer);
        clearResolverRef.current.resolve();
        clearResolverRef.current = null;
      }
      socket.close();
    };
  }, [handleServerEvent, handleUnknownServerEvent]);

  const books = useMemo(() => Object.values(state.book?.books ?? {}), [state.book]);
  const isConnected = state.connection === "connected";

  const sendClientEvent = useCallback((event: ClientEvent) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(JSON.stringify(event));
    return true;
  }, []);

  const stopSimulator = useCallback(() => {
    dispatch({ type: "simulator", running: false });
    sendClientEvent({ event_type: "simulator_stop", payload: {} });
  }, [sendClientEvent]);

  const waitForClear = useCallback(() => {
    if (!isConnected) return Promise.resolve();
    return new Promise<void>((resolve) => {
      if (clearResolverRef.current) {
        window.clearTimeout(clearResolverRef.current.timer);
        clearResolverRef.current.resolve();
      }
      clearResolverRef.current = {
        resolve,
        timer: window.setTimeout(() => {
          clearResolverRef.current = null;
          resolve();
        }, CLEAR_TIMEOUT_MS)
      };
    });
  }, [isConnected]);

  const resetVisibleWorkstationState = useCallback(() => {
    dispatch({ type: "clear_all" });
    setMessage(DEFAULT_MESSAGE);
    setBrokerId(DEFAULT_BROKER_ID);
    setRandomness(DEFAULT_RANDOMNESS);
    setNoiseRate(DEFAULT_NOISE_RATE);
    setChaosRate(DEFAULT_CHAOS_RATE);
    setTickerTypoRate(DEFAULT_TICKER_TYPO_RATE);
    setTemplateNoiseRate(DEFAULT_TEMPLATE_NOISE_RATE);
    setIntervalMs(DEFAULT_INTERVAL_MS);
    setUploadStatus("");
    setUploadError("");
  }, []);

  const clearAll = useCallback(async () => {
    if (state.simulatorRunning) {
      stopSimulator();
    }
    resetVisibleWorkstationState();

    const clearAck = waitForClear();
    sendClientEvent({ event_type: "book_clear", payload: {} });
    await clearAck;
  }, [
    resetVisibleWorkstationState,
    sendClientEvent,
    state.simulatorRunning,
    stopSimulator,
    waitForClear
  ]);

  const submitUserMessage = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const trimmed = message.trim();
      if (!trimmed) return;
      sendClientEvent({
        event_type: "user_message",
        payload: { broker_id: brokerId, text: trimmed }
      });
    },
    [brokerId, message, sendClientEvent]
  );

  const startSimulator = useCallback(() => {
    dispatch({ type: "simulator", running: true });
    sendClientEvent({
      event_type: "simulator_start",
      payload: {
        randomness,
        noise_rate: noiseRate,
        chaos_rate: chaosRate,
        ticker_typo_rate: tickerTypoRate,
        template_noise_rate: templateNoiseRate,
        interval_ms: intervalMs
      }
    });
  }, [
    chaosRate,
    intervalMs,
    noiseRate,
    randomness,
    sendClientEvent,
    templateNoiseRate,
    tickerTypoRate
  ]);

  const toggleSimulator = useCallback(() => {
    if (state.simulatorRunning) {
      stopSimulator();
    } else {
      startSimulator();
    }
  }, [startSimulator, state.simulatorRunning, stopSimulator]);

  const uploadReplay = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (uploadingReplay) return;
      setUploadingReplay(true);
      if (state.simulatorRunning) {
        stopSimulator();
      }
      resetVisibleWorkstationState();

      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch(`${HTTP_URL}/samples/replay`, {
          method: "POST",
          body: formData
        });
        if (!response.ok) {
          setUploadError(await replayErrorMessage(response));
          return;
        }
        const body = (await response.json()) as ReplayResponse;
        let acceptedEvents = 0;
        for (const event of body.events) {
          if (isEventEnvelope(event) && isValidServerEventPayload(event)) {
            handleServerEvent(event);
            acceptedEvents += 1;
          } else {
            handleUnknownServerEvent("Ignored malformed replay event");
          }
        }
        setUploadStatus(`Replay uploaded: ${acceptedEvents} events`);
        if (body.rejected_rows && body.rejected_rows > 0) {
          toast.warning(`Replay completed with ${body.rejected_rows} rejected rows`);
        }
      } catch {
        setUploadError("Replay failed. API unavailable; verify backend on port 8000.");
      } finally {
        setUploadingReplay(false);
      }
    },
    [
      handleServerEvent,
      handleUnknownServerEvent,
      resetVisibleWorkstationState,
      state.simulatorRunning,
      stopSimulator,
      uploadingReplay
    ]
  );

  return {
    state,
    books,
    isConnected,
    message,
    setMessage,
    brokerId,
    setBrokerId,
    randomness,
    setRandomness,
    noiseRate,
    setNoiseRate,
    chaosRate,
    setChaosRate,
    tickerTypoRate,
    setTickerTypoRate,
    templateNoiseRate,
    setTemplateNoiseRate,
    intervalMs,
    setIntervalMs,
    uploadStatus,
    uploadError,
    uploadingReplay,
    submitUserMessage,
    uploadReplay,
    toggleSimulator,
    clearAll
  };
}

export type WorkstationController = ReturnType<typeof useWorkstation>;

async function replayErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ReplayErrorResponse;
    if (isSafeReplayDetail(body.detail)) {
      return `Replay failed: ${body.detail}`;
    }
  } catch {
    // Fall through to the generic message below.
  }
  return "Replay failed. Check file type/schema, then retry.";
}

function isSafeReplayDetail(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120;
}

function isEmptyBookPayload(value: unknown): value is BookStatePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "books" in value &&
    typeof value.books === "object" &&
    value.books !== null &&
    Object.keys(value.books).length === 0
  );
}
