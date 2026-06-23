import { describe, expect, it } from "vitest";

import type { BookStatePayload, EventEnvelope } from "@/lib/events";
import { initialState, workstationReducer } from "@/lib/state";

function envelope(sequence: number, event_id = `event-${sequence}`): EventEnvelope {
  return {
    event_id,
    event_type: "message_received",
    schema_version: 1,
    sequence,
    session_id: "session-1",
    correlation_id: "corr-1",
    occurred_at: "2026-06-19T12:00:00Z",
    payload: {
      message_id: `msg-${sequence}`,
      broker_id: "BROKER_A",
      received_timestamp: "2026-06-19T12:00:00Z",
      text: "vendo petro27 7.30 5mm"
    }
  };
}

describe("workstationReducer", () => {
  it("applies events in sequence order", () => {
    const state = workstationReducer(initialState, {
      type: "server_event",
      event: envelope(1)
    });

    expect(state.lastSequence).toBe(1);
    expect(state.messages).toHaveLength(1);
  });

  it("deduplicates event ids", () => {
    const first = workstationReducer(initialState, {
      type: "server_event",
      event: envelope(1, "dup")
    });
    const second = workstationReducer(first, {
      type: "server_event",
      event: envelope(2, "dup")
    });

    expect(second.messages).toHaveLength(1);
    expect(second.lastSequence).toBe(1);
  });

  it("ignores lower out-of-order sequence", () => {
    const first = workstationReducer(initialState, {
      type: "server_event",
      event: envelope(2)
    });
    const second = workstationReducer(first, {
      type: "server_event",
      event: envelope(1)
    });

    expect(second.lastSequence).toBe(2);
    expect(second.messages).toHaveLength(1);
  });

  it("clears full visible workstation state", () => {
    const state = workstationReducer(initialState, {
      type: "server_event",
      event: envelope(1)
    });
    const withBook = workstationReducer(state, {
      type: "server_event",
      event: {
        ...envelope(2),
        event_id: "book-1",
        event_type: "book_updated",
        payload: {
          books: {
            PETRO27: {
              instrument_id: "PETRO27",
              best_bid: null,
              best_ask: null,
              rows: [],
              updated_timestamp: "2026-06-19T12:00:00Z"
            }
          },
          updated_timestamp: "2026-06-19T12:00:00Z"
        } satisfies BookStatePayload
      }
    });

    const cleared = workstationReducer(withBook, { type: "clear_all" });

    expect(cleared.book).toBeNull();
    expect(cleared.messages).toHaveLength(0);
    expect(cleared.events).toHaveLength(0);
    expect(cleared.lastSequence).toBe(0);
  });

  it("ignores malformed payloads without mutating event feeds", () => {
    const state = workstationReducer(initialState, {
      type: "server_event",
      event: {
        ...envelope(1),
        payload: { message_id: "missing-fields" }
      }
    });

    expect(state.messages).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    expect(state.lastSequence).toBe(0);
  });

  it("stores client errors in event history without touching book state", () => {
    const state = workstationReducer(initialState, {
      type: "server_event",
      event: {
        ...envelope(1),
        event_type: "client_error",
        payload: {
          code: "invalid_user_message",
          message: "payload.text: invalid"
        }
      }
    });

    expect(state.events).toHaveLength(1);
    expect(state.clientErrors).toHaveLength(1);
    expect(state.streamStatus.tone).toBe("warning");
    expect(state.book).toBeNull();
  });
});
