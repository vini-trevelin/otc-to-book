from __future__ import annotations

from otc_to_book.simulator.generator import ChatMessageGenerator, SimulatorConfig


def test_simulator_seed_is_deterministic() -> None:
    first = ChatMessageGenerator(SimulatorConfig(seed=42, noise_rate=0))
    second = ChatMessageGenerator(SimulatorConfig(seed=42, noise_rate=0))

    assert first.next_message().text == second.next_message().text


def test_simulator_can_emit_noise() -> None:
    generator = ChatMessageGenerator(SimulatorConfig(seed=42, noise_rate=1))

    assert generator.next_message().text in {
        "bom dia",
        "sem mercado agora",
        "call me",
        "alguem tem fluxo?",
    }


def test_simulator_chaos_is_deterministic_with_same_seed() -> None:
    config = SimulatorConfig(
        seed=7,
        noise_rate=0,
        chaos_rate=1,
        ticker_typo_rate=1,
        template_noise_rate=1,
    )
    first = ChatMessageGenerator(config)
    second = ChatMessageGenerator(config)

    assert [first.next_message().text for _ in range(5)] == [
        second.next_message().text for _ in range(5)
    ]


def test_simulator_chaos_rate_one_modifies_every_quote() -> None:
    chaotic = ChatMessageGenerator(SimulatorConfig(seed=11, noise_rate=0, chaos_rate=1))

    assert all("  " in chaotic.next_message().text for _ in range(5))


def test_simulator_ticker_typos_cover_multiple_tickers() -> None:
    generator = ChatMessageGenerator(
        SimulatorConfig(seed=3, noise_rate=0, chaos_rate=1, ticker_typo_rate=1)
    )
    messages = [generator.next_message().text.lower() for _ in range(80)]

    assert any("petor27" in message or "petroo27" in message for message in messages)
    assert any("valee29" in message or "vlae29" in message for message in messages)
    assert any("bove26" in message or "bovva26" in message for message in messages)


def test_simulator_noise_messages_are_not_chaos_modified() -> None:
    generator = ChatMessageGenerator(
        SimulatorConfig(seed=42, noise_rate=1, chaos_rate=1, ticker_typo_rate=1)
    )

    assert generator.next_message().text in {
        "bom dia",
        "sem mercado agora",
        "call me",
        "alguem tem fluxo?",
    }
