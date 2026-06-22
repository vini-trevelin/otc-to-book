from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from otc_to_book.domain.extraction import DeterministicQuoteExtractor, QuoteExtractor
from otc_to_book.domain.models import RawMessage


@dataclass(frozen=True)
class MetricCount:
    correct: int
    total: int

    @property
    def accuracy(self) -> float:
        if self.total == 0:
            return 1.0
        return self.correct / self.total


@dataclass(frozen=True)
class ExtractionEvaluation:
    total_examples: int
    quote_examples: int
    rejection_examples: int
    ticker: MetricCount
    side: MetricCount
    quote_value: MetricCount
    quantity: MetricCount
    rejection_reason: MetricCount
    exact_row: MetricCount
    clean_exact: MetricCount
    chaotic_positive_exact: MetricCount
    hard_negative_exact: MetricCount
    rejection_exact: MetricCount
    false_merge: MetricCount


def evaluate_extraction(
    messages_path: Path,
    expected_path: Path,
    *,
    extractor: QuoteExtractor | None = None,
) -> ExtractionEvaluation:
    messages = {
        row["message_id"]: row for row in _read_jsonl(messages_path)
    }
    expected_rows = _read_jsonl(expected_path)
    quote_examples = 0
    rejection_examples = 0
    ticker_correct = 0
    side_correct = 0
    quote_value_correct = 0
    quantity_correct = 0
    rejection_reason_correct = 0
    exact_row_correct = 0
    category_counts: dict[str, list[int]] = {
        "clean": [0, 0],
        "chaotic_positive": [0, 0],
        "hard_negative": [0, 0],
        "rejection": [0, 0],
    }
    false_merge_correct = 0
    false_merge_total = 0
    quote_extractor = extractor or DeterministicQuoteExtractor()

    for expected in expected_rows:
        raw = RawMessage(**messages[expected["message_id"]])
        result = quote_extractor.extract(raw)
        category = expected.get("category", "clean")
        if category not in category_counts:
            category_counts[category] = [0, 0]
        category_counts[category][1] += 1

        if expected["expected_type"] == "rejection":
            rejection_examples += 1
            reasons = [reason.value for reason in result.errors]
            reason_matches = result.candidate is None and expected["reason"] in reasons
            rejection_reason_correct += int(reason_matches)
            exact_row_correct += int(reason_matches)
            category_counts[category][0] += int(reason_matches)
            continue

        quote_examples += 1
        candidate = result.candidate
        if candidate is None:
            false_merge = _count_false_merge(expected, None)
            false_merge_correct += false_merge[0]
            false_merge_total += false_merge[1]
            continue

        ticker_matches = candidate.instrument_id == expected["instrument_id"]
        side_matches = candidate.side == expected["side"]
        quote_value_matches = str(candidate.quote_value) == expected["quote_value"]
        quantity_matches = str(candidate.quantity) == expected["quantity"]
        quote_value_type_matches = candidate.quote_value_type == expected["quote_value_type"]
        quantity_unit_matches = candidate.quantity_unit == expected["quantity_unit"]

        ticker_correct += int(ticker_matches)
        side_correct += int(side_matches)
        quote_value_correct += int(quote_value_matches and quote_value_type_matches)
        quantity_correct += int(quantity_matches and quantity_unit_matches)
        exact_row_matches = (
            ticker_matches
            and side_matches
            and quote_value_matches
            and quote_value_type_matches
            and quantity_matches
            and quantity_unit_matches
        )
        exact_row_correct += int(exact_row_matches)
        category_counts[category][0] += int(exact_row_matches)

        false_merge = _count_false_merge(expected, candidate.instrument_id)
        false_merge_correct += false_merge[0]
        false_merge_total += false_merge[1]

    total_examples = len(expected_rows)
    return ExtractionEvaluation(
        total_examples=total_examples,
        quote_examples=quote_examples,
        rejection_examples=rejection_examples,
        ticker=MetricCount(ticker_correct, quote_examples),
        side=MetricCount(side_correct, quote_examples),
        quote_value=MetricCount(quote_value_correct, quote_examples),
        quantity=MetricCount(quantity_correct, quote_examples),
        rejection_reason=MetricCount(rejection_reason_correct, rejection_examples),
        exact_row=MetricCount(exact_row_correct, total_examples),
        clean_exact=MetricCount(*category_counts["clean"]),
        chaotic_positive_exact=MetricCount(*category_counts["chaotic_positive"]),
        hard_negative_exact=MetricCount(*category_counts["hard_negative"]),
        rejection_exact=MetricCount(*category_counts["rejection"]),
        false_merge=MetricCount(false_merge_correct, false_merge_total),
    )


def format_evaluation(evaluation: ExtractionEvaluation) -> str:
    lines = [
        f"total_examples={evaluation.total_examples}",
        f"quote_examples={evaluation.quote_examples}",
        f"rejection_examples={evaluation.rejection_examples}",
    ]
    for name in (
        "ticker",
        "side",
        "quote_value",
        "quantity",
        "rejection_reason",
        "exact_row",
        "clean_exact",
        "chaotic_positive_exact",
        "hard_negative_exact",
        "rejection_exact",
        "false_merge",
    ):
        metric = getattr(evaluation, name)
        lines.append(
            f"{name}={metric.correct}/{metric.total} ({metric.accuracy:.2%})"
        )
    return "\n".join(lines)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def _count_false_merge(expected: dict[str, Any], instrument_id: str | None) -> tuple[int, int]:
    forbidden_instrument_id = expected.get("forbidden_instrument_id")
    if not forbidden_instrument_id:
        return 0, 0
    return int(instrument_id != forbidden_instrument_id), 1
