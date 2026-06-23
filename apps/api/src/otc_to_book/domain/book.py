from __future__ import annotations

from uuid import uuid4

from otc_to_book.domain.models import (
    BookRow,
    BookRowStatus,
    BookState,
    QuoteEvent,
    QuoteSide,
    TickerBook,
    utc_now,
)


class BookBuilder:
    def __init__(self) -> None:
        self._rows_by_instrument: dict[str, list[BookRow]] = {}

    def apply_quote(self, quote: QuoteEvent) -> BookState:
        rows = self._rows_by_instrument.setdefault(quote.instrument_id, [])
        now = utc_now()

        for index, row in enumerate(rows):
            if (
                row.status == BookRowStatus.ACTIVE
                and row.quote_event.broker_id == quote.broker_id
                and row.quote_event.side == quote.side
            ):
                rows[index] = row.model_copy(
                    update={
                        "status": BookRowStatus.SUPERSEDED,
                        "superseded_timestamp": now,
                    }
                )

        rows.append(
            BookRow(
                row_id=str(uuid4()),
                quote_event=quote,
                status=BookRowStatus.ACTIVE,
            )
        )

        return self.snapshot()

    def clear(self) -> BookState:
        self._rows_by_instrument.clear()
        return self.snapshot()

    def snapshot(self) -> BookState:
        now = utc_now()
        books = {
            instrument_id: self._ticker_book(instrument_id, rows, now)
            for instrument_id, rows in sorted(self._rows_by_instrument.items())
        }
        return BookState(books=books, updated_timestamp=now)

    def _ticker_book(
        self,
        instrument_id: str,
        rows: list[BookRow],
        updated_timestamp,
    ) -> TickerBook:
        active_bids = [
            row
            for row in rows
            if row.status == BookRowStatus.ACTIVE and row.quote_event.side == QuoteSide.BID
        ]
        active_asks = [
            row
            for row in rows
            if row.status == BookRowStatus.ACTIVE and row.quote_event.side == QuoteSide.ASK
        ]

        best_bid = sorted(
            active_bids,
            key=lambda row: (row.quote_event.quote_value, row.quote_event.received_timestamp),
            reverse=True,
        )
        best_ask = sorted(
            active_asks,
            key=lambda row: (
                row.quote_event.quote_value,
                -row.quote_event.received_timestamp.timestamp(),
            ),
        )

        return TickerBook(
            instrument_id=instrument_id,
            best_bid=best_bid[0] if best_bid else None,
            best_ask=best_ask[0] if best_ask else None,
            rows=tuple(self._sort_rows(rows)),
            updated_timestamp=updated_timestamp,
        )

    def _sort_rows(self, rows: list[BookRow]) -> list[BookRow]:
        return sorted(
            rows,
            key=lambda row: (
                row.status != BookRowStatus.ACTIVE,
                row.quote_event.side != QuoteSide.BID,
                -row.quote_event.quote_value
                if row.quote_event.side == QuoteSide.BID
                else row.quote_event.quote_value,
                -row.quote_event.received_timestamp.timestamp(),
            ),
        )
