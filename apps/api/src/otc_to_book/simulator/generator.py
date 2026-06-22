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
    chaos_rate: float = 0
    ticker_typo_rate: float = 0
    template_noise_rate: float = 0
    broker_ids: tuple[str, ...] = ("BROKER_A", "BROKER_B", "BROKER_C")
    seed: int | None = None

    def __post_init__(self) -> None:
        if self.randomness < 1 or self.randomness > 5:
            raise ValueError("randomness must be between 1 and 5")
        for field_name in (
            "noise_rate",
            "chaos_rate",
            "ticker_typo_rate",
            "template_noise_rate",
        ):
            value = getattr(self, field_name)
            if value < 0 or value > 1:
                raise ValueError(f"{field_name} must be between 0 and 1")
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
        self._ticker_typo_variants = {
            "petro27": ("petroo27", "petrro27", "petr027", "petor27"),
            "PETR27": ("PETR27",),
            "vale29": ("valee29", "vlae29"),
            "bova26": ("bove26", "bovva26"),
        }

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
        chaos_enabled = self._random.random() < self.config.chaos_rate
        if chaos_enabled and self._random.random() < self.config.ticker_typo_rate:
            ticker = self._random.choice(self._ticker_typo_variants[ticker])

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
        if not chaos_enabled:
            return template
        return self._chaotic_quote(template)

    def _chaotic_quote(self, text: str) -> str:
        transformed = text
        if self._random.random() < self.config.template_noise_rate:
            transformed = self._random.choice(
                (
                    self._with_mixed_ticker_case,
                    self._with_decimal_comma,
                    self._with_extra_spacing,
                    self._with_unparseable_ticker_split,
                    self._with_uncertain_trailer,
                )
            )(transformed)

        if transformed == text:
            transformed = self._with_extra_spacing(transformed)
        return transformed

    def _price(self) -> Decimal:
        base = Decimal("7.20")
        max_ticks = 5 * self.config.randomness
        ticks = self._random.randint(0, max_ticks)
        return base + Decimal(ticks) / Decimal("100")

    def _size(self) -> int:
        max_size = max(1, self.config.randomness * 2)
        return self._random.randint(1, max_size)

    def _with_decimal_comma(self, text: str) -> str:
        return text.replace(".", ",", 1)

    def _with_mixed_ticker_case(self, text: str) -> str:
        for ticker in ("petro27", "PETR27", "vale29", "bova26"):
            if ticker in text:
                mixed = "".join(
                    char.upper() if index % 2 == 0 else char.lower()
                    for index, char in enumerate(ticker.lower())
                )
                return text.replace(ticker, mixed, 1)
        return self._with_extra_spacing(text)

    def _with_extra_spacing(self, text: str) -> str:
        return "  ".join(text.split())

    def _with_unparseable_ticker_split(self, text: str) -> str:
        for ticker in ("petro27", "PETR27", "vale29", "bova26"):
            if ticker in text:
                return text.replace(ticker, f"{ticker[:-2]} {ticker[-2:]}", 1)
        return self._with_extra_spacing(text)

    def _with_uncertain_trailer(self, text: str) -> str:
        return f"{text} maybe"
