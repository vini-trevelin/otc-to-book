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


CANONICAL_TICKER_ALIASES = {
    "PETROO27": "PETRO27",
    "PETRRO27": "PETRO27",
    "PETR027": "PETRO27",
}
FUZZY_EXCLUSION_TICKERS = frozenset({"PETR27", "BOVE26"})
TICKER_PARTS_PATTERN = re.compile(r"^(?P<root>[A-Z]+)(?P<suffix>\d+)$")


def normalize_for_matching(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).strip()


def normalize_instrument(raw_ticker: str) -> str:
    return raw_ticker.strip().upper()


class TickerResolver:
    def __init__(
        self,
        aliases: dict[str, str] | None = None,
        *,
        enable_fuzzy: bool = True,
        fuzzy_exclusions: set[str] | frozenset[str] | None = None,
    ) -> None:
        self._aliases = aliases or CANONICAL_TICKER_ALIASES
        self._enable_fuzzy = enable_fuzzy
        self._fuzzy_exclusions = frozenset(fuzzy_exclusions or FUZZY_EXCLUSION_TICKERS)
        self._valid_tickers: set[str] = set()

    @property
    def valid_tickers(self) -> frozenset[str]:
        return frozenset(self._valid_tickers)

    def resolve(self, raw_ticker: str) -> str:
        normalized = normalize_instrument(raw_ticker)
        aliased = self._aliases.get(normalized)
        if aliased is not None:
            self._valid_tickers.add(aliased)
            return aliased

        if normalized in self._valid_tickers:
            return normalized

        fuzzy_match = self._resolve_fuzzy(normalized)
        if fuzzy_match is not None:
            return fuzzy_match

        self._valid_tickers.add(normalized)
        return normalized

    def _resolve_fuzzy(self, normalized: str) -> str | None:
        if not self._enable_fuzzy:
            return None
        if normalized in self._fuzzy_exclusions:
            return None
        if normalized in set(self._aliases.values()):
            return None

        ticker_parts = _split_ticker(normalized)
        if ticker_parts is None:
            return None
        root, suffix = ticker_parts
        if len(root) < 4:
            return None

        matches = []
        for candidate in sorted(self._valid_tickers):
            if candidate in self._fuzzy_exclusions:
                continue
            candidate_parts = _split_ticker(candidate)
            if candidate_parts is None:
                continue
            candidate_root, candidate_suffix = candidate_parts
            if suffix != candidate_suffix or len(candidate_root) < 4:
                continue
            if _levenshtein_distance(root, candidate_root) == 1:
                matches.append(candidate)

        if len(matches) == 1:
            return matches[0]
        return None


def _split_ticker(normalized: str) -> tuple[str, str] | None:
    match = TICKER_PARTS_PATTERN.match(normalized)
    if match is None:
        return None
    return match.group("root"), match.group("suffix")


def _levenshtein_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    if len(left) == len(right):
        for index in range(len(left) - 1):
            swapped = f"{left[:index]}{left[index + 1]}{left[index]}{left[index + 2:]}"
            if swapped == right:
                return 1
    if len(left) < len(right):
        left, right = right, left

    previous = list(range(len(right) + 1))
    for left_index, left_char in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_char in enumerate(right, start=1):
            substitution_cost = 0 if left_char == right_char else 1
            current.append(
                min(
                    previous[right_index] + 1,
                    current[right_index - 1] + 1,
                    previous[right_index - 1] + substitution_cost,
                )
            )
        previous = current
    return previous[-1]


def parse_decimal(value: str, *, compact: bool = False) -> Decimal:
    cleaned = value.strip().replace(",", ".")
    if compact and "." not in cleaned:
        if not cleaned.isdigit() or len(cleaned) < 3:
            raise ValueError(f"invalid compact price: {value}")
        cleaned = f"{cleaned[:-2]}.{cleaned[-2:]}"
    return Decimal(cleaned)


class DeterministicQuoteExtractor:
    method = "deterministic_v1"

    def __init__(self, ticker_resolver: TickerResolver | None = None) -> None:
        self._ticker_resolver = ticker_resolver or TickerResolver()
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
            instrument_id=self._ticker_resolver.resolve(raw_ticker),
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
