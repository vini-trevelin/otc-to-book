from __future__ import annotations

from uuid import uuid4

from otc_to_book.domain.models import (
    QuoteCandidate,
    QuoteEvent,
    QuoteRejected,
    RawMessage,
    RejectionReason,
    utc_now,
)


class QuoteValidator:
    def validate(self, candidate: QuoteCandidate) -> QuoteEvent | QuoteRejected:
        reasons = self._rejection_reasons(candidate)
        if reasons:
            return QuoteRejected(
                rejection_id=str(uuid4()),
                raw_message_id=candidate.raw_message_id,
                broker_id=candidate.broker_id,
                raw_message=candidate.raw_message,
                received_timestamp=candidate.received_timestamp,
                processed_timestamp=utc_now(),
                reasons=tuple(reasons),
                candidate=candidate,
            )

        raw_ticker = candidate.raw_ticker
        instrument_id = candidate.instrument_id
        side = candidate.side
        quote_value = candidate.quote_value
        quote_value_type = candidate.quote_value_type
        quantity = candidate.quantity
        quantity_unit = candidate.quantity_unit
        if (
            raw_ticker is None
            or instrument_id is None
            or side is None
            or quote_value is None
            or quote_value_type is None
            or quantity is None
            or quantity_unit is None
        ):
            raise AssertionError("validated quote candidate still has missing fields")

        return QuoteEvent(
            event_id=str(uuid4()),
            raw_ticker=raw_ticker,
            instrument_id=instrument_id,
            side=side,
            quote_value=quote_value,
            quote_value_type=quote_value_type,
            quantity=quantity,
            quantity_unit=quantity_unit,
            broker_id=candidate.broker_id,
            confidence=candidate.confidence,
            received_timestamp=candidate.received_timestamp,
            processed_timestamp=utc_now(),
            raw_message_id=candidate.raw_message_id,
            raw_message=candidate.raw_message,
        )

    def reject_raw_message(
        self,
        raw_message: RawMessage,
        reasons: tuple[RejectionReason, ...],
    ) -> QuoteRejected:
        return QuoteRejected(
            rejection_id=str(uuid4()),
            raw_message_id=raw_message.message_id,
            broker_id=raw_message.broker_id,
            raw_message=raw_message.text,
            received_timestamp=raw_message.received_timestamp,
            processed_timestamp=utc_now(),
            reasons=reasons,
            candidate=None,
        )

    def _rejection_reasons(self, candidate: QuoteCandidate) -> list[RejectionReason]:
        reasons: list[RejectionReason] = []

        if not candidate.raw_ticker or not candidate.instrument_id:
            reasons.append(RejectionReason.MISSING_TICKER)
        if candidate.side is None:
            reasons.append(RejectionReason.MISSING_SIDE)
        if candidate.quote_value is None:
            reasons.append(RejectionReason.MISSING_QUOTE_VALUE)
        if candidate.quote_value_type is None:
            reasons.append(RejectionReason.MISSING_QUOTE_VALUE)
        if candidate.quantity is None:
            reasons.append(RejectionReason.MISSING_QUANTITY)
        elif candidate.quantity <= 0:
            reasons.append(RejectionReason.INVALID_QUANTITY)
        if candidate.confidence < 0 or candidate.confidence > 1:
            reasons.append(RejectionReason.INVALID_CONFIDENCE)

        return reasons
