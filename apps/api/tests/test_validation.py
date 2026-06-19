from __future__ import annotations

from decimal import Decimal

from otc_to_book.domain.extraction import DeterministicQuoteExtractor
from otc_to_book.domain.models import QuoteCandidate, QuoteEvent, QuoteRejected, RejectionReason
from otc_to_book.domain.validation import QuoteValidator


def candidate(raw_message, text: str = "vendo petro27 7.30 5mm") -> QuoteCandidate:
    result = DeterministicQuoteExtractor().extract(raw_message(text))
    assert result.candidate is not None
    return result.candidate


def test_valid_candidate_becomes_quote_event(raw_message) -> None:
    validated = QuoteValidator().validate(candidate(raw_message))

    assert isinstance(validated, QuoteEvent)
    assert validated.instrument_id == "PETRO27"


def test_missing_ticker_is_rejected(raw_message) -> None:
    invalid = candidate(raw_message).model_copy(update={"raw_ticker": None, "instrument_id": None})

    validated = QuoteValidator().validate(invalid)

    assert isinstance(validated, QuoteRejected)
    assert RejectionReason.MISSING_TICKER in validated.reasons


def test_zero_quantity_is_rejected(raw_message) -> None:
    invalid = candidate(raw_message).model_copy(update={"quantity": Decimal("0")})

    validated = QuoteValidator().validate(invalid)

    assert isinstance(validated, QuoteRejected)
    assert RejectionReason.INVALID_QUANTITY in validated.reasons


def test_missing_quote_value_type_is_rejected(raw_message) -> None:
    invalid = candidate(raw_message).model_copy(update={"quote_value_type": None})

    validated = QuoteValidator().validate(invalid)

    assert isinstance(validated, QuoteRejected)
    assert RejectionReason.MISSING_QUOTE_VALUE in validated.reasons
