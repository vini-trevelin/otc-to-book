from __future__ import annotations

from pathlib import Path

from otc_to_book.application.evaluation import evaluate_extraction, format_evaluation

ROOT = Path(__file__).resolve().parents[3]


def test_sample_fixture_evaluation_reports_perfect_accuracy() -> None:
    evaluation = evaluate_extraction(
        ROOT / "data/samples/v1_messages.jsonl",
        ROOT / "data/samples/v1_expected_quotes.jsonl",
    )

    assert evaluation.total_examples == 14
    assert evaluation.quote_examples == 10
    assert evaluation.rejection_examples == 4
    assert evaluation.ticker.correct == evaluation.ticker.total == 10
    assert evaluation.side.correct == evaluation.side.total == 10
    assert evaluation.quote_value.correct == evaluation.quote_value.total == 10
    assert evaluation.quantity.correct == evaluation.quantity.total == 10
    assert evaluation.rejection_reason.correct == evaluation.rejection_reason.total == 4
    assert evaluation.exact_row.correct == evaluation.exact_row.total == 14


def test_sample_fixture_evaluation_formats_counts() -> None:
    evaluation = evaluate_extraction(
        ROOT / "data/samples/v1_messages.jsonl",
        ROOT / "data/samples/v1_expected_quotes.jsonl",
    )

    report = format_evaluation(evaluation)

    assert "total_examples=14" in report
    assert "ticker=10/10 (100.00%)" in report
    assert "rejection_reason=4/4 (100.00%)" in report
    assert "exact_row=14/14 (100.00%)" in report
