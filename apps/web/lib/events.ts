export type EventType =
  | "message_received"
  | "quote_parsed"
  | "quote_rejected"
  | "quote_event"
  | "book_updated"
  | "client_error";

export type ClientEventType = "user_message" | "simulator_start" | "simulator_stop" | "book_clear";

export type EventEnvelope<TPayload = unknown> = {
  event_id: string;
  event_type: EventType;
  schema_version: 1;
  sequence: number;
  session_id: string;
  correlation_id: string;
  occurred_at: string;
  payload: TPayload;
};

export type ClientEvent<TPayload = unknown> = {
  event_type: ClientEventType;
  payload: TPayload;
};

export type RawMessagePayload = {
  message_id: string;
  broker_id: string;
  received_timestamp: string;
  text: string;
};

export type QuoteEventPayload = {
  event_id: string;
  raw_ticker: string;
  instrument_id: string;
  side: "BID" | "ASK";
  quote_value: string;
  quote_value_type: "PRICE" | "SPREAD";
  quantity: string;
  quantity_unit: "MM" | "UNITS";
  broker_id: string;
  confidence: string;
  received_timestamp: string;
  processed_timestamp: string;
  raw_message_id: string;
  raw_message: string;
};

export type QuoteRejectedPayload = {
  rejection_id: string;
  raw_message_id: string;
  broker_id: string;
  raw_message: string;
  received_timestamp: string;
  processed_timestamp: string;
  reasons: string[];
};

export type ClientErrorPayload = {
  code: string;
  message: string;
};

export type BookRow = {
  row_id: string;
  quote_event: QuoteEventPayload;
  status: "ACTIVE" | "SUPERSEDED";
  superseded_timestamp: string | null;
};

export type TickerBook = {
  instrument_id: string;
  best_bid: BookRow | null;
  best_ask: BookRow | null;
  rows: BookRow[];
  updated_timestamp: string;
};

export type BookStatePayload = {
  books: Record<string, TickerBook>;
  updated_timestamp: string;
};

const EVENT_TYPES = new Set<EventType>([
  "message_received",
  "quote_parsed",
  "quote_rejected",
  "quote_event",
  "book_updated",
  "client_error"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isEventType(value: unknown): value is EventType {
  return isString(value) && EVENT_TYPES.has(value as EventType);
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (!isRecord(value)) return false;
  return (
    isString(value.event_id) &&
    isEventType(value.event_type) &&
    value.schema_version === 1 &&
    isNumber(value.sequence) &&
    isString(value.session_id) &&
    isString(value.correlation_id) &&
    isString(value.occurred_at) &&
    "payload" in value
  );
}

export function isRawMessagePayload(value: unknown): value is RawMessagePayload {
  if (!isRecord(value)) return false;
  return (
    isString(value.message_id) &&
    isString(value.broker_id) &&
    isString(value.received_timestamp) &&
    isString(value.text)
  );
}

export function isQuoteEventPayload(value: unknown): value is QuoteEventPayload {
  if (!isRecord(value)) return false;
  return (
    isString(value.event_id) &&
    isString(value.raw_ticker) &&
    isString(value.instrument_id) &&
    (value.side === "BID" || value.side === "ASK") &&
    isString(value.quote_value) &&
    (value.quote_value_type === "PRICE" || value.quote_value_type === "SPREAD") &&
    isString(value.quantity) &&
    (value.quantity_unit === "MM" || value.quantity_unit === "UNITS") &&
    isString(value.broker_id) &&
    isString(value.confidence) &&
    isString(value.received_timestamp) &&
    isString(value.processed_timestamp) &&
    isString(value.raw_message_id) &&
    isString(value.raw_message)
  );
}

export function isQuoteRejectedPayload(value: unknown): value is QuoteRejectedPayload {
  if (!isRecord(value)) return false;
  return (
    isString(value.rejection_id) &&
    isString(value.raw_message_id) &&
    isString(value.broker_id) &&
    isString(value.raw_message) &&
    isString(value.received_timestamp) &&
    isString(value.processed_timestamp) &&
    Array.isArray(value.reasons) &&
    value.reasons.every(isString)
  );
}

export function isBookStatePayload(value: unknown): value is BookStatePayload {
  if (!isRecord(value) || !isRecord(value.books) || !isString(value.updated_timestamp)) {
    return false;
  }
  return Object.values(value.books).every((book) => {
    if (!isRecord(book)) return false;
    return (
      isString(book.instrument_id) &&
      ("best_bid" in book) &&
      ("best_ask" in book) &&
      Array.isArray(book.rows) &&
      isString(book.updated_timestamp)
    );
  });
}

export function isClientErrorPayload(value: unknown): value is ClientErrorPayload {
  if (!isRecord(value)) return false;
  return isString(value.code) && isString(value.message);
}

export function isValidServerEventPayload(event: EventEnvelope): boolean {
  if (event.event_type === "message_received") return isRawMessagePayload(event.payload);
  if (event.event_type === "quote_event") return isQuoteEventPayload(event.payload);
  if (event.event_type === "quote_rejected") return isQuoteRejectedPayload(event.payload);
  if (event.event_type === "book_updated") return isBookStatePayload(event.payload);
  if (event.event_type === "client_error") return isClientErrorPayload(event.payload);
  return event.event_type === "quote_parsed";
}
