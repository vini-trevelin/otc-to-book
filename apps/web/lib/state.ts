import type {
  BookStatePayload,
  EventEnvelope,
  QuoteEventPayload,
  QuoteRejectedPayload,
  RawMessagePayload
} from "@/lib/events";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export type WorkstationState = {
  connection: ConnectionState;
  simulatorRunning: boolean;
  lastSequence: number;
  seenEventIds: Set<string>;
  messages: RawMessagePayload[];
  events: EventEnvelope[];
  quoteEvents: QuoteEventPayload[];
  rejections: QuoteRejectedPayload[];
  book: BookStatePayload | null;
};

export type WorkstationAction =
  | { type: "connection"; connection: ConnectionState }
  | { type: "simulator"; running: boolean }
  | { type: "server_event"; event: EventEnvelope };

export const initialState: WorkstationState = {
  connection: "connecting",
  simulatorRunning: false,
  lastSequence: 0,
  seenEventIds: new Set(),
  messages: [],
  events: [],
  quoteEvents: [],
  rejections: [],
  book: null
};

export function workstationReducer(
  state: WorkstationState,
  action: WorkstationAction
): WorkstationState {
  if (action.type === "connection") {
    return { ...state, connection: action.connection };
  }

  if (action.type === "simulator") {
    return { ...state, simulatorRunning: action.running };
  }

  const event = action.event;
  if (state.seenEventIds.has(event.event_id) || event.sequence <= state.lastSequence) {
    return state;
  }

  const seenEventIds = new Set(state.seenEventIds);
  seenEventIds.add(event.event_id);
  const next: WorkstationState = {
    ...state,
    lastSequence: event.sequence,
    seenEventIds,
    events: [event, ...state.events].slice(0, 80)
  };

  if (event.event_type === "message_received") {
    return {
      ...next,
      messages: [event.payload as RawMessagePayload, ...state.messages].slice(0, 80)
    };
  }

  if (event.event_type === "quote_event") {
    return {
      ...next,
      quoteEvents: [event.payload as QuoteEventPayload, ...state.quoteEvents].slice(0, 80)
    };
  }

  if (event.event_type === "quote_rejected") {
    return {
      ...next,
      rejections: [event.payload as QuoteRejectedPayload, ...state.rejections].slice(0, 80)
    };
  }

  if (event.event_type === "book_updated") {
    return {
      ...next,
      book: event.payload as BookStatePayload
    };
  }

  return next;
}
