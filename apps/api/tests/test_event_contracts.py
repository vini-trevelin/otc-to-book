from __future__ import annotations

from otc_to_book.application.pipeline import QuotePipeline


def test_event_envelope_contract(raw_message) -> None:
    events = QuotePipeline(session_id="session-1").process_message(
        raw_message("bid petro27 7.25"),
        correlation_id="corr-1",
    )

    first = events[0]
    assert first.schema_version == 1
    assert first.session_id == "session-1"
    assert first.correlation_id == "corr-1"
    assert first.event_id
    assert first.occurred_at.tzinfo is not None
    assert [event.sequence for event in events] == sorted(event.sequence for event in events)
