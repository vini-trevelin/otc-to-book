from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

from otc_to_book.domain.models import (
    ExtractionResult,
    QuantityUnit,
    QuoteCandidate,
    QuoteSide,
    QuoteValueType,
    RawMessage,
    RejectionReason,
    utc_now,
)


class QuoteExtractor(Protocol):
    def extract(self, raw_message: RawMessage) -> ExtractionResult: ...


@dataclass(frozen=True)
class TemplateRule:
    template_id: str
    pattern: re.Pattern[str]
    side: QuoteSide
    compact_price: bool = False
    default_quantity: Decimal | None = None


def normalize_for_matching(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).strip()


def normalize_instrument(raw_ticker: str) -> str:
    return raw_ticker.strip().upper()


def parse_decimal(value: str, *, compact: bool = False) -> Decimal:
    cleaned = value.strip().replace(",", ".")
    if compact and "." not in cleaned:
        if not cleaned.isdigit() or len(cleaned) < 3:
            raise ValueError(f"invalid compact price: {value}")
        cleaned = f"{cleaned[:-2]}.{cleaned[-2:]}"
    return Decimal(cleaned)


class DeterministicQuoteExtractor:
    method = "deterministic_v1"

    def __init__(self) -> None:
        ticker = r"(?P<ticker>[A-Za-z]{3,}[A-Za-z0-9]*\d{2})"
        price = r"(?P<price>\d+(?:[\.,]\d+)?)"
        size = r"(?P<size>\d+(?:[\.,]\d+)?)"
        self._rules = (
            TemplateRule(
                "vendo_ticker_price_size",
                re.compile(rf"^\s*vendo\s+{ticker}\s+{price}\s+{size}\s*mm\s*$", re.I),
                QuoteSide.ASK,
            ),
            TemplateRule(
                "ticker_offer_price_size",
                re.compile(
                    rf"^\s*{ticker}\s+offer\s+{price}\s+size\s+{size}\s*$",
                    re.I,
                ),
                QuoteSide.ASK,
            ),
            TemplateRule(
                "size_ticker_at_price",
                re.compile(rf"^\s*{size}\s*mm\s+{ticker}\s+@{price}\s*$", re.I),
                QuoteSide.ASK,
                compact_price=True,
            ),
            TemplateRule(
                "bid_ticker_price",
                re.compile(rf"^\s*bid\s+{ticker}\s+{price}\s*$", re.I),
                QuoteSide.BID,
                default_quantity=Decimal("1"),
            ),
            TemplateRule(
                "tomo_ticker_ate_price",
                re.compile(rf"^\s*tomo\s+{ticker}\s+ate\s+{price}\s*$", re.I),
                QuoteSide.BID,
                default_quantity=Decimal("1"),
            ),
        )

    def extract(self, raw_message: RawMessage) -> ExtractionResult:
        text = normalize_for_matching(raw_message.text)
        processed_timestamp = utc_now()

        for rule in self._rules:
            match = rule.pattern.match(text)
            if match:
                return self._candidate_from_match(raw_message, processed_timestamp, rule, match)

        return ExtractionResult(
            candidate=None,
            errors=(RejectionReason.NO_QUOTE_DETECTED,),
            method=self.method,
            confidence=Decimal("0"),
        )

    def _candidate_from_match(
        self,
        raw_message: RawMessage,
        processed_timestamp: datetime,
        rule: TemplateRule,
        match: re.Match[str],
    ) -> ExtractionResult:
        raw_ticker = match.group("ticker")
        size = match.groupdict().get("size")
        quantity = parse_decimal(size) if size else rule.default_quantity
        candidate = QuoteCandidate(
            raw_ticker=raw_ticker,
            instrument_id=normalize_instrument(raw_ticker),
            side=rule.side,
            quote_value=parse_decimal(match.group("price"), compact=rule.compact_price),
            quote_value_type=QuoteValueType.PRICE,
            quantity=quantity,
            quantity_unit=QuantityUnit.MM if quantity is not None else None,
            broker_id=raw_message.broker_id,
            confidence=Decimal("0.95"),
            received_timestamp=raw_message.received_timestamp,
            processed_timestamp=processed_timestamp,
            raw_message_id=raw_message.message_id,
            raw_message=raw_message.text,
            extraction_method=self.method,
            template_id=rule.template_id,
        )
        return ExtractionResult(
            candidate=candidate,
            errors=(),
            method=self.method,
            confidence=candidate.confidence,
            template_id=rule.template_id,
        )
