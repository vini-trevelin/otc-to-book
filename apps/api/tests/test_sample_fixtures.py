from __future__ import annotations

import json
from pathlib import Path

from otc_to_book.domain.extraction import DeterministicQuoteExtractor
from otc_to_book.domain.models import RawMessage

ROOT = Path(__file__).resolve().parents[3]


def test_sample_messages_match_expected_outputs() -> None:
    messages = {
        row["message_id"]: row
        for row in (
            json.loads(line)
            for line in (ROOT / "data/samples/v1_messages.jsonl").read_text().splitlines()
        )
    }
    expected_rows = [
        json.loads(line)
        for line in (ROOT / "data/samples/v1_expected_quotes.jsonl").read_text().splitlines()
    ]
    extractor = DeterministicQuoteExtractor()

    for expected in expected_rows:
        message = messages[expected["message_id"]]
        raw = RawMessage(**message)
        result = extractor.extract(raw)
        if expected["expected_type"] == "rejection":
            assert result.candidate is None
            assert expected["reason"] in [reason.value for reason in result.errors]
        else:
            assert result.candidate is not None
            assert result.candidate.instrument_id == expected["instrument_id"]
            assert result.candidate.side == expected["side"]
            assert str(result.candidate.quote_value) == expected["quote_value"]
            assert result.candidate.quote_value_type == expected["quote_value_type"]
            assert str(result.candidate.quantity) == expected["quantity"]
            assert result.candidate.quantity_unit == expected["quantity_unit"]
