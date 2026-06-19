from __future__ import annotations

from otc_to_book.application.pipeline import QuotePipeline
from otc_to_book.domain.models import RejectionReason


def test_pipeline_emits_quote_and_book_events(raw_message) -> None:
    events = QuotePipeline(session_id="session-1").process_message(
        raw_message("vendo petro27 7.30 5mm"),
        correlation_id="corr-1",
    )

    assert [event.event_type for event in events] == [
        "message_received",
        "quote_parsed",
        "quote_event",
        "book_updated",
    ]
    assert {event.correlation_id for event in events} == {"corr-1"}
    assert [event.sequence for event in events] == [1, 2, 3, 4]


def test_pipeline_rejects_noise_without_book_update(raw_message) -> None:
    events = QuotePipeline(session_id="session-1").process_message(raw_message("bom dia"))

    assert [event.event_type for event in events] == ["message_received", "quote_rejected"]
    assert events[-1].payload["reasons"] == [RejectionReason.NO_QUOTE_DETECTED.value]
