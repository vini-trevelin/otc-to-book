from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import BaseModel

from otc_to_book.domain.book import BookBuilder
from otc_to_book.domain.extraction import DeterministicQuoteExtractor, QuoteExtractor
from otc_to_book.domain.models import (
    BookState,
    ClientError,
    EventEnvelope,
    QuoteRejected,
    RawMessage,
    RejectionReason,
    ServerEventType,
    utc_now,
)
from otc_to_book.domain.validation import QuoteValidator


def json_payload(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json")


class QuotePipeline:
    def __init__(
        self,
        *,
        extractor: QuoteExtractor | None = None,
        validator: QuoteValidator | None = None,
        book_builder: BookBuilder | None = None,
        session_id: str | None = None,
    ) -> None:
        self.extractor = extractor or DeterministicQuoteExtractor()
        self.validator = validator or QuoteValidator()
        self.book_builder = book_builder or BookBuilder()
        self.session_id = session_id or str(uuid4())
        self._sequence = 0

    def process_message(
        self,
        raw_message: RawMessage,
        *,
        correlation_id: str | None = None,
    ) -> list[EventEnvelope]:
        correlation = correlation_id or str(uuid4())
        events = [
            self._envelope(
                ServerEventType.MESSAGE_RECEIVED,
                correlation,
                json_payload(raw_message),
            )
        ]

        extraction = self.extractor.extract(raw_message)
        if extraction.candidate is not None:
            events.append(
                self._envelope(
                    ServerEventType.QUOTE_PARSED,
                    correlation,
                    json_payload(extraction.candidate),
                )
            )
            validated = self.validator.validate(extraction.candidate)
        else:
            reasons = extraction.errors or (RejectionReason.NO_QUOTE_DETECTED,)
            validated = self.validator.reject_raw_message(raw_message, reasons)

        if isinstance(validated, QuoteRejected):
            events.append(
                self._envelope(
                    ServerEventType.QUOTE_REJECTED,
                    correlation,
                    json_payload(validated),
                )
            )
            return events

        events.append(
            self._envelope(
                ServerEventType.QUOTE_EVENT,
                correlation,
                json_payload(validated),
            )
        )
        book_state = self.book_builder.apply_quote(validated)
        events.append(
            self._envelope(
                ServerEventType.BOOK_UPDATED,
                correlation,
                json_payload(book_state),
            )
        )
        return events

    def reject_message(
        self,
        raw_message: RawMessage,
        reasons: tuple[RejectionReason, ...],
        *,
        correlation_id: str | None = None,
    ) -> list[EventEnvelope]:
        correlation = correlation_id or str(uuid4())
        rejected = self.validator.reject_raw_message(raw_message, reasons)
        return [
            self._envelope(
                ServerEventType.MESSAGE_RECEIVED,
                correlation,
                json_payload(raw_message),
            ),
            self._envelope(
                ServerEventType.QUOTE_REJECTED,
                correlation,
                json_payload(rejected),
            ),
        ]

    def client_error(
        self,
        *,
        code: str,
        message: str,
        correlation_id: str | None = None,
    ) -> EventEnvelope:
        correlation = correlation_id or str(uuid4())
        return self._envelope(
            ServerEventType.CLIENT_ERROR,
            correlation,
            json_payload(ClientError(code=code, message=message)),
        )

    def snapshot(self) -> BookState:
        return self.book_builder.snapshot()

    def clear_books(self, *, correlation_id: str | None = None) -> EventEnvelope:
        correlation = correlation_id or str(uuid4())
        book_state = self.book_builder.clear()
        return self._envelope(
            ServerEventType.BOOK_UPDATED,
            correlation,
            json_payload(book_state),
        )

    def _envelope(
        self,
        event_type: ServerEventType,
        correlation_id: str,
        payload: dict[str, Any],
    ) -> EventEnvelope:
        self._sequence += 1
        return EventEnvelope(
            event_id=str(uuid4()),
            event_type=event_type,
            schema_version=1,
            sequence=self._sequence,
            session_id=self.session_id,
            correlation_id=correlation_id,
            occurred_at=utc_now(),
            payload=payload,
        )
