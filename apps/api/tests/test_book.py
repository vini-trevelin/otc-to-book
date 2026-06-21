from __future__ import annotations

from decimal import Decimal

from otc_to_book.domain.book import BookBuilder
from otc_to_book.domain.extraction import DeterministicQuoteExtractor
from otc_to_book.domain.models import BookRowStatus, QuoteEvent
from otc_to_book.domain.validation import QuoteValidator


def quote(
    raw_message,
    text: str,
    *,
    broker_id: str = "BROKER_A",
    message_id: str = "msg",
) -> QuoteEvent:
    result = DeterministicQuoteExtractor().extract(
        raw_message(text, broker_id=broker_id, message_id=message_id)
    )
    assert result.candidate is not None
    validated = QuoteValidator().validate(result.candidate)
    assert isinstance(validated, QuoteEvent)
    return validated


def test_book_tracks_best_bid_and_ask(raw_message) -> None:
    builder = BookBuilder()
    builder.apply_quote(quote(raw_message, "bid petro27 7.25", broker_id="B1", message_id="b1"))
    state = builder.apply_quote(
        quote(raw_message, "vendo petro27 7.30 5mm", broker_id="A1", message_id="a1")
    )

    book = state.books["PETRO27"]
    assert book.best_bid is not None
    assert book.best_bid.quote_event.quote_value == Decimal("7.25")
    assert book.best_ask is not None
    assert book.best_ask.quote_event.quote_value == Decimal("7.30")


def test_same_broker_instrument_side_replaces_active_row(raw_message) -> None:
    builder = BookBuilder()
    builder.apply_quote(quote(raw_message, "bid petro27 7.25", message_id="old"))
    state = builder.apply_quote(quote(raw_message, "bid petro27 7.27", message_id="new"))

    rows = state.books["PETRO27"].rows
    assert [row.status for row in rows] == [BookRowStatus.ACTIVE, BookRowStatus.SUPERSEDED]
    assert rows[0].quote_event.quote_value == Decimal("7.27")
    assert rows[1].quote_event.quote_value == Decimal("7.25")
    assert rows[1].superseded_timestamp is not None


def test_alias_instrument_replaces_same_broker_active_row(raw_message) -> None:
    builder = BookBuilder()
    builder.apply_quote(quote(raw_message, "bid petro27 7.25", message_id="old"))
    state = builder.apply_quote(quote(raw_message, "bid petroo27 7.27", message_id="new"))

    assert sorted(state.books) == ["PETRO27"]
    rows = state.books["PETRO27"].rows
    assert [row.status for row in rows] == [BookRowStatus.ACTIVE, BookRowStatus.SUPERSEDED]
    assert rows[0].quote_event.raw_ticker == "petroo27"
    assert rows[0].quote_event.instrument_id == "PETRO27"
    assert rows[0].quote_event.quote_value == Decimal("7.27")


def test_new_valid_ticker_creates_separate_book(raw_message) -> None:
    builder = BookBuilder()
    builder.apply_quote(quote(raw_message, "bid petro27 7.25", message_id="petro"))
    state = builder.apply_quote(quote(raw_message, "bid vale29 7.27", message_id="vale"))

    assert sorted(state.books) == ["PETRO27", "VALE29"]
    assert state.books["VALE29"].best_bid is not None
    assert state.books["VALE29"].best_bid.quote_event.raw_ticker == "vale29"
