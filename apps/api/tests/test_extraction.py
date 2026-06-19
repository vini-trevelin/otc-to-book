from __future__ import annotations

from decimal import Decimal

import pytest

from otc_to_book.domain.extraction import DeterministicQuoteExtractor
from otc_to_book.domain.models import QuoteSide, RejectionReason


@pytest.mark.parametrize(
    ("text", "side", "instrument_id", "quote_value", "quantity"),
    [
        ("vendo petro27 7.30 5mm", QuoteSide.ASK, "PETRO27", Decimal("7.30"), Decimal("5")),
        ("PETR27 OFFER 7.30 SIZE 5", QuoteSide.ASK, "PETR27", Decimal("7.30"), Decimal("5")),
        ("5mm petro27 @730", QuoteSide.ASK, "PETRO27", Decimal("7.30"), Decimal("5")),
        ("bid petro27 7.25", QuoteSide.BID, "PETRO27", Decimal("7.25"), Decimal("1")),
        ("tomo petro27 até 7.26", QuoteSide.BID, "PETRO27", Decimal("7.26"), Decimal("1")),
    ],
)
def test_extracts_supported_templates(
    raw_message,
    text: str,
    side: QuoteSide,
    instrument_id: str,
    quote_value: Decimal,
    quantity: Decimal,
) -> None:
    result = DeterministicQuoteExtractor().extract(raw_message(text))

    assert result.errors == ()
    assert result.candidate is not None
    assert result.candidate.side == side
    assert result.candidate.instrument_id == instrument_id
    assert result.candidate.quote_value == quote_value
    assert result.candidate.quantity == quantity
    assert result.candidate.template_id is not None


def test_noise_returns_extraction_result_without_candidate(raw_message) -> None:
    result = DeterministicQuoteExtractor().extract(raw_message("bom dia"))

    assert result.candidate is None
    assert result.errors == (RejectionReason.NO_QUOTE_DETECTED,)
