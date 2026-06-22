from __future__ import annotations

from decimal import Decimal

import pytest

from otc_to_book.domain.extraction import DeterministicQuoteExtractor, TickerResolver
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


@pytest.mark.parametrize(
    "text",
    ["vendo petroo27 7.30 5mm", "bid petrro27 7.25", "5mm petr027 @730"],
)
def test_explicit_ticker_aliases_resolve_to_canonical_instrument(raw_message, text: str) -> None:
    result = DeterministicQuoteExtractor().extract(raw_message(text))

    assert result.candidate is not None
    assert result.candidate.raw_ticker in text
    assert result.candidate.instrument_id == "PETRO27"


def test_petr27_remains_distinct_from_petro27(raw_message) -> None:
    extractor = DeterministicQuoteExtractor()

    petro = extractor.extract(raw_message("vendo petro27 7.30 5mm", message_id="petro"))
    petr = extractor.extract(raw_message("PETR27 OFFER 7.31 SIZE 4", message_id="petr"))

    assert petro.candidate is not None
    assert petr.candidate is not None
    assert petro.candidate.instrument_id == "PETRO27"
    assert petr.candidate.instrument_id == "PETR27"


def test_unknown_valid_ticker_is_added_to_session_pool(raw_message) -> None:
    resolver = TickerResolver()
    extractor = DeterministicQuoteExtractor(ticker_resolver=resolver)

    result = extractor.extract(raw_message("vendo vale29 7.30 5mm"))

    assert result.candidate is not None
    assert result.candidate.raw_ticker == "vale29"
    assert result.candidate.instrument_id == "VALE29"
    assert "VALE29" in resolver.valid_tickers
    assert "PETRO27" not in resolver.valid_tickers


def test_ticker_pool_is_scoped_to_resolver_instance(raw_message) -> None:
    first = TickerResolver()
    second = TickerResolver()

    DeterministicQuoteExtractor(ticker_resolver=first).extract(raw_message("vendo vale29 7.30 5mm"))

    assert first.valid_tickers == frozenset({"VALE29"})
    assert second.valid_tickers == frozenset()


def test_bounded_fuzzy_resolves_single_candidate_after_canonical_exists(raw_message) -> None:
    extractor = DeterministicQuoteExtractor()

    extractor.extract(raw_message("vendo petro27 7.30 5mm", message_id="canonical"))
    result = extractor.extract(raw_message("vendo petor27 7.31 2mm", message_id="fuzzy"))

    assert result.candidate is not None
    assert result.candidate.raw_ticker == "petor27"
    assert result.candidate.instrument_id == "PETRO27"


def test_bounded_fuzzy_does_not_guess_before_canonical_exists(raw_message) -> None:
    result = DeterministicQuoteExtractor().extract(raw_message("vendo petor27 7.31 2mm"))

    assert result.candidate is not None
    assert result.candidate.instrument_id == "PETOR27"


def test_bounded_fuzzy_can_be_disabled(raw_message) -> None:
    resolver = TickerResolver(enable_fuzzy=False)
    extractor = DeterministicQuoteExtractor(ticker_resolver=resolver)

    extractor.extract(raw_message("vendo petro27 7.30 5mm", message_id="canonical"))
    result = extractor.extract(raw_message("vendo petor27 7.31 2mm", message_id="fuzzy"))

    assert result.candidate is not None
    assert result.candidate.instrument_id == "PETOR27"
    assert resolver.valid_tickers == frozenset({"PETRO27", "PETOR27"})


def test_bounded_fuzzy_preserves_excluded_tickers(raw_message) -> None:
    extractor = DeterministicQuoteExtractor()

    extractor.extract(raw_message("vendo petro27 7.30 5mm", message_id="petro"))
    petr = extractor.extract(raw_message("PETR27 OFFER 7.31 SIZE 4", message_id="petr"))

    assert petr.candidate is not None
    assert petr.candidate.instrument_id == "PETR27"


def test_bounded_fuzzy_requires_matching_numeric_suffix(raw_message) -> None:
    extractor = DeterministicQuoteExtractor()

    extractor.extract(raw_message("vendo petro27 7.30 5mm", message_id="canonical"))
    result = extractor.extract(raw_message("vendo petor28 7.31 2mm", message_id="suffix"))

    assert result.candidate is not None
    assert result.candidate.instrument_id == "PETOR28"


def test_bounded_fuzzy_keeps_ambiguous_matches_separate() -> None:
    resolver = TickerResolver(aliases={"PETRAA27": "PETRA27"})

    assert resolver.resolve("petro27") == "PETRO27"
    assert resolver.resolve("petraa27") == "PETRA27"
    assert resolver.resolve("petri27") == "PETRI27"


def test_explicit_aliases_run_before_bounded_fuzzy(raw_message) -> None:
    resolver = TickerResolver()
    extractor = DeterministicQuoteExtractor(ticker_resolver=resolver)

    extractor.extract(raw_message("vendo petr27 7.30 5mm", message_id="distinct"))
    result = extractor.extract(raw_message("vendo petr027 7.32 2mm", message_id="alias"))

    assert result.candidate is not None
    assert result.candidate.instrument_id == "PETRO27"
