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


def test_pipeline_canonicalizes_alias_ticker_in_events_and_book(raw_message) -> None:
    pipeline = QuotePipeline(session_id="session-1")
    pipeline.process_message(raw_message("bid petro27 7.25", message_id="old"))
    events = pipeline.process_message(raw_message("bid petroo27 7.27", message_id="new"))

    parsed = next(event for event in events if event.event_type == "quote_parsed")
    quote_event = next(event for event in events if event.event_type == "quote_event")
    book_updated = next(event for event in events if event.event_type == "book_updated")

    assert parsed.payload["raw_ticker"] == "petroo27"
    assert parsed.payload["instrument_id"] == "PETRO27"
    assert quote_event.payload["raw_ticker"] == "petroo27"
    assert quote_event.payload["instrument_id"] == "PETRO27"
    assert sorted(book_updated.payload["books"]) == ["PETRO27"]
    assert len(book_updated.payload["books"]["PETRO27"]["rows"]) == 2


def test_pipeline_adds_new_valid_ticker_to_book(raw_message) -> None:
    pipeline = QuotePipeline(session_id="session-1")
    pipeline.process_message(raw_message("bid petro27 7.25", message_id="petro"))
    events = pipeline.process_message(raw_message("bid vale29 7.27", message_id="vale"))

    book_updated = next(event for event in events if event.event_type == "book_updated")

    assert sorted(book_updated.payload["books"]) == ["PETRO27", "VALE29"]
    assert (
        book_updated.payload["books"]["VALE29"]["best_bid"]["quote_event"]["raw_ticker"]
        == "vale29"
    )


def test_pipeline_fuzzy_ticker_after_canonical_uses_existing_book(raw_message) -> None:
    pipeline = QuotePipeline(session_id="session-1")
    pipeline.process_message(raw_message("bid petro27 7.25", message_id="old"))
    events = pipeline.process_message(raw_message("bid petor27 7.27", message_id="new"))

    parsed = next(event for event in events if event.event_type == "quote_parsed")
    book_updated = next(event for event in events if event.event_type == "book_updated")

    assert parsed.payload["raw_ticker"] == "petor27"
    assert parsed.payload["instrument_id"] == "PETRO27"
    assert sorted(book_updated.payload["books"]) == ["PETRO27"]
    assert len(book_updated.payload["books"]["PETRO27"]["rows"]) == 2


def test_pipeline_fuzzy_ticker_before_canonical_creates_own_book(raw_message) -> None:
    pipeline = QuotePipeline(session_id="session-1")
    first_events = pipeline.process_message(raw_message("bid petor27 7.27", message_id="first"))
    second_events = pipeline.process_message(raw_message("bid petro27 7.25", message_id="second"))

    first_book = next(event for event in first_events if event.event_type == "book_updated")
    second_book = next(event for event in second_events if event.event_type == "book_updated")

    assert sorted(first_book.payload["books"]) == ["PETOR27"]
    assert sorted(second_book.payload["books"]) == ["PETOR27", "PETRO27"]


def test_pipeline_hard_negative_ticker_stays_separate(raw_message) -> None:
    pipeline = QuotePipeline(session_id="session-1")
    pipeline.process_message(raw_message("vendo bova26 7.50 2mm", message_id="bova"))
    events = pipeline.process_message(raw_message("vendo bove26 7.51 1mm", message_id="bove"))

    book_updated = next(event for event in events if event.event_type == "book_updated")

    assert sorted(book_updated.payload["books"]) == ["BOVA26", "BOVE26"]


def test_pipeline_clear_books_emits_empty_book_state(raw_message) -> None:
    pipeline = QuotePipeline(session_id="session-1")
    pipeline.process_message(raw_message("bid petro27 7.25"))

    event = pipeline.clear_books(correlation_id="clear-1")

    assert event.event_type == "book_updated"
    assert event.correlation_id == "clear-1"
    assert event.payload["books"] == {}
