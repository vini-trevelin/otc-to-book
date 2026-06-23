from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QuoteSide(StrEnum):
    BID = "BID"
    ASK = "ASK"


class QuantityUnit(StrEnum):
    MM = "MM"
    UNITS = "UNITS"


class QuoteValueType(StrEnum):
    PRICE = "PRICE"
    SPREAD = "SPREAD"


class BookRowStatus(StrEnum):
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"


class ServerEventType(StrEnum):
    MESSAGE_RECEIVED = "message_received"
    QUOTE_PARSED = "quote_parsed"
    QUOTE_REJECTED = "quote_rejected"
    QUOTE_EVENT = "quote_event"
    BOOK_UPDATED = "book_updated"
    CLIENT_ERROR = "client_error"


class RejectionReason(StrEnum):
    NO_QUOTE_DETECTED = "NO_QUOTE_DETECTED"
    MISSING_TICKER = "MISSING_TICKER"
    MISSING_SIDE = "MISSING_SIDE"
    MISSING_QUOTE_VALUE = "MISSING_QUOTE_VALUE"
    MISSING_QUANTITY = "MISSING_QUANTITY"
    INVALID_QUANTITY = "INVALID_QUANTITY"
    INVALID_CONFIDENCE = "INVALID_CONFIDENCE"
    INVALID_TIMESTAMP = "INVALID_TIMESTAMP"
    UNSUPPORTED_TEMPLATE = "UNSUPPORTED_TEMPLATE"


def utc_now() -> datetime:
    return datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return value.astimezone(UTC)


class DomainModel(BaseModel):
    model_config = ConfigDict(frozen=True)


class RawMessage(DomainModel):
    message_id: str
    broker_id: str
    received_timestamp: datetime
    text: str
    replay_id: str | None = None
    replay_sequence: int | None = Field(default=None, ge=1)

    @field_validator("received_timestamp")
    @classmethod
    def validate_received_timestamp(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class QuoteCandidate(DomainModel):
    raw_ticker: str | None
    instrument_id: str | None
    side: QuoteSide | None
    quote_value: Decimal | None
    quote_value_type: QuoteValueType | None
    quantity: Decimal | None
    quantity_unit: QuantityUnit | None
    broker_id: str
    confidence: Decimal = Field(ge=Decimal("0"), le=Decimal("1"))
    received_timestamp: datetime
    processed_timestamp: datetime
    raw_message_id: str
    raw_message: str
    extraction_method: str
    extraction_errors: tuple[RejectionReason, ...] = ()
    template_id: str | None = None

    @field_validator("received_timestamp", "processed_timestamp")
    @classmethod
    def validate_timestamps(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class ExtractionResult(DomainModel):
    candidate: QuoteCandidate | None
    errors: tuple[RejectionReason, ...] = ()
    method: str
    confidence: Decimal = Field(ge=Decimal("0"), le=Decimal("1"))
    template_id: str | None = None


class QuoteEvent(DomainModel):
    event_id: str
    raw_ticker: str
    instrument_id: str
    side: QuoteSide
    quote_value: Decimal
    quote_value_type: QuoteValueType
    quantity: Decimal
    quantity_unit: QuantityUnit
    broker_id: str
    confidence: Decimal = Field(ge=Decimal("0"), le=Decimal("1"))
    received_timestamp: datetime
    processed_timestamp: datetime
    raw_message_id: str
    raw_message: str

    @field_validator("received_timestamp", "processed_timestamp")
    @classmethod
    def validate_timestamps(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class QuoteRejected(DomainModel):
    rejection_id: str
    raw_message_id: str
    broker_id: str
    raw_message: str
    received_timestamp: datetime
    processed_timestamp: datetime
    reasons: tuple[RejectionReason, ...]
    candidate: QuoteCandidate | None = None

    @field_validator("received_timestamp", "processed_timestamp")
    @classmethod
    def validate_timestamps(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class BookRow(DomainModel):
    row_id: str
    quote_event: QuoteEvent
    status: BookRowStatus
    superseded_timestamp: datetime | None = None

    @field_validator("superseded_timestamp")
    @classmethod
    def validate_superseded_timestamp(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return ensure_utc(value)


class TickerBook(DomainModel):
    instrument_id: str
    best_bid: BookRow | None
    best_ask: BookRow | None
    rows: tuple[BookRow, ...]
    updated_timestamp: datetime

    @field_validator("updated_timestamp")
    @classmethod
    def validate_updated_timestamp(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class BookState(DomainModel):
    books: dict[str, TickerBook]
    updated_timestamp: datetime

    @field_validator("updated_timestamp")
    @classmethod
    def validate_updated_timestamp(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class ClientError(DomainModel):
    code: str
    message: str


class EventEnvelope(DomainModel):
    event_id: str
    event_type: ServerEventType
    schema_version: int = 1
    sequence: int = Field(ge=1)
    session_id: str
    correlation_id: str
    occurred_at: datetime
    payload: dict[str, Any]

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, value: datetime) -> datetime:
        return ensure_utc(value)
