export type EventType =
  | "message_received"
  | "quote_parsed"
  | "quote_rejected"
  | "quote_event"
  | "book_updated";

export type ClientEventType = "user_message" | "simulator_start" | "simulator_stop";

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
