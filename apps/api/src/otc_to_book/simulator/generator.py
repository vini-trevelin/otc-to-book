from __future__ import annotations

import random
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from otc_to_book.domain.models import RawMessage, utc_now


@dataclass(frozen=True)
class SimulatorConfig:
    randomness: int = 3
    noise_rate: float = 0.2
    broker_ids: tuple[str, ...] = ("BROKER_A", "BROKER_B", "BROKER_C")
    seed: int | None = None

    def __post_init__(self) -> None:
        if self.randomness < 1 or self.randomness > 5:
            raise ValueError("randomness must be between 1 and 5")
        if self.noise_rate < 0 or self.noise_rate > 1:
            raise ValueError("noise_rate must be between 0 and 1")
        if not self.broker_ids:
            raise ValueError("at least one broker_id is required")


class ChatMessageGenerator:
    def __init__(self, config: SimulatorConfig) -> None:
        self.config = config
        self.session_id = str(uuid4())
        self.sequence = 0
        self._random = random.Random(config.seed)
        self._noise_messages = (
            "bom dia",
            "sem mercado agora",
            "call me",
            "alguem tem fluxo?",
        )

    def next_message(self) -> RawMessage:
        self.sequence += 1
        broker_id = self._random.choice(self.config.broker_ids)
        if self._random.random() < self.config.noise_rate:
            text = self._random.choice(self._noise_messages)
        else:
            text = self._quote_message()

        return RawMessage(
            message_id=f"{self.session_id}-{self.sequence}",
            broker_id=broker_id,
            received_timestamp=utc_now(),
            text=text,
        )

    def _quote_message(self) -> str:
        ticker = self._random.choice(("petro27", "PETR27", "vale29", "bova26"))
        price = self._price()
        size = self._size()
        compact_price = str(price).replace(".", "")
        template = self._random.choice(
            (
                f"vendo {ticker} {price} {size}mm",
                f"{ticker.upper()} OFFER {price} SIZE {size}",
                f"{size}mm {ticker} @{compact_price}",
                f"bid {ticker} {price}",
                f"tomo {ticker} ate {price}",
            )
        )
        return template

    def _price(self) -> Decimal:
        base = Decimal("7.20")
        max_ticks = 5 * self.config.randomness
        ticks = self._random.randint(0, max_ticks)
        return base + Decimal(ticks) / Decimal("100")

    def _size(self) -> int:
        max_size = max(1, self.config.randomness * 2)
        return self._random.randint(1, max_size)
