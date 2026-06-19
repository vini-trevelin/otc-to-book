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
