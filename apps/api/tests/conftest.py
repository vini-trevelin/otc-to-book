from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

import pytest

from otc_to_book.domain.models import RawMessage


@pytest.fixture
def raw_message() -> Callable[..., RawMessage]:
    def factory(
        text: str,
        *,
        broker_id: str = "BROKER_A",
        message_id: str = "msg-1",
    ) -> RawMessage:
        return RawMessage(
            message_id=message_id,
            broker_id=broker_id,
            received_timestamp=datetime(2026, 6, 19, 12, 0, tzinfo=UTC),
            text=text,
        )

    return factory
