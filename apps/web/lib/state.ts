import type {
  BookStatePayload,
  ClientErrorPayload,
  EventEnvelope,
  QuoteEventPayload,
  QuoteRejectedPayload,
  RawMessagePayload
} from "@/lib/events";
import {
  isBookStatePayload,
  isClientErrorPayload,
  isQuoteEventPayload,
  isQuoteRejectedPayload,
  isRawMessagePayload
} from "@/lib/events";

export type ConnectionState = "connecting" | "connected" | "disconnected";
export type StreamStatus = {
  tone: "normal" | "warning";
  message: string | null;
};

export type WorkstationState = {
  connection: ConnectionState;
  streamStatus: StreamStatus;
  simulatorRunning: boolean;
  lastSequence: number;
  seenEventIds: Set<string>;
  messages: RawMessagePayload[];
  events: EventEnvelope[];
  quoteEvents: QuoteEventPayload[];
  rejections: QuoteRejectedPayload[];
  clientErrors: ClientErrorPayload[];
  book: BookStatePayload | null;
};

export type WorkstationAction =
  | { type: "connection"; connection: ConnectionState }
  | { type: "stream_status"; status: StreamStatus }
  | { type: "simulator"; running: boolean }
  | { type: "clear_all" }
  | { type: "server_event"; event: EventEnvelope };

export const initialState: WorkstationState = {
  connection: "connecting",
  streamStatus: { tone: "normal", message: null },
  simulatorRunning: false,
  lastSequence: 0,
  seenEventIds: new Set(),
  messages: [],
  events: [],
  quoteEvents: [],
  rejections: [],
  clientErrors: [],
  book: null
};

export function workstationReducer(
  state: WorkstationState,
  action: WorkstationAction
): WorkstationState {
  if (action.type === "connection") {
    return { ...state, connection: action.connection };
  }

  if (action.type === "stream_status") {
    return { ...state, streamStatus: action.status };
  }

  if (action.type === "simulator") {
    return { ...state, simulatorRunning: action.running };
  }

  if (action.type === "clear_all") {
    return {
      ...initialState,
      connection: state.connection,
      streamStatus: state.streamStatus,
      seenEventIds: new Set()
    };
  }

  const event = action.event;
  if (state.seenEventIds.has(event.event_id) || event.sequence <= state.lastSequence) {
    return state;
  }

  if (event.event_type === "message_received") {
    if (!isRawMessagePayload(event.payload)) return state;
    const next = nextEventState(state, event);
    return {
      ...next,
      messages: [event.payload, ...state.messages].slice(0, 80)
    };
  }

  if (event.event_type === "quote_event") {
    if (!isQuoteEventPayload(event.payload)) return state;
    const next = nextEventState(state, event);
    return {
      ...next,
      quoteEvents: [event.payload, ...state.quoteEvents].slice(0, 80)
    };
  }

  if (event.event_type === "quote_rejected") {
    if (!isQuoteRejectedPayload(event.payload)) return state;
    const next = nextEventState(state, event);
    return {
      ...next,
      rejections: [event.payload, ...state.rejections].slice(0, 80)
    };
  }

  if (event.event_type === "book_updated") {
    if (!isBookStatePayload(event.payload)) return state;
    const next = nextEventState(state, event);
    return {
      ...next,
      book: event.payload
    };
  }

  if (event.event_type === "client_error") {
    if (!isClientErrorPayload(event.payload)) return state;
    const next = nextEventState(state, event);
    return {
      ...next,
      streamStatus: { tone: "warning", message: event.payload.message },
      clientErrors: [event.payload, ...state.clientErrors].slice(0, 80)
    };
  }

  return nextEventState(state, event);
}

function nextEventState(state: WorkstationState, event: EventEnvelope): WorkstationState {
  const seenEventIds = new Set(state.seenEventIds);
  seenEventIds.add(event.event_id);
  return {
    ...state,
    lastSequence: event.sequence,
    seenEventIds,
    events: [event, ...state.events].slice(0, 80)
  };
}
