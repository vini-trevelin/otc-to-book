from __future__ import annotations

from pathlib import Path

from otc_to_book.application.evaluation import evaluate_extraction, format_evaluation

ROOT = Path(__file__).resolve().parents[3]


def test_sample_fixture_evaluation_reports_perfect_accuracy() -> None:
    evaluation = evaluate_extraction(
        ROOT / "data/samples/v1_messages.jsonl",
        ROOT / "data/samples/v1_expected_quotes.jsonl",
    )

    assert evaluation.total_examples == 27
    assert evaluation.quote_examples == 20
    assert evaluation.rejection_examples == 7
    assert evaluation.ticker.correct == evaluation.ticker.total == 20
    assert evaluation.side.correct == evaluation.side.total == 20
    assert evaluation.quote_value.correct == evaluation.quote_value.total == 20
    assert evaluation.quantity.correct == evaluation.quantity.total == 20
    assert evaluation.rejection_reason.correct == evaluation.rejection_reason.total == 7
    assert evaluation.exact_row.correct == evaluation.exact_row.total == 27
    assert evaluation.clean_exact.correct == evaluation.clean_exact.total == 14
    assert evaluation.chaotic_positive_exact.correct == evaluation.chaotic_positive_exact.total == 7
    assert evaluation.hard_negative_exact.correct == evaluation.hard_negative_exact.total == 3
    assert evaluation.rejection_exact.correct == evaluation.rejection_exact.total == 3
    assert evaluation.false_merge.correct == evaluation.false_merge.total == 3


def test_sample_fixture_evaluation_formats_counts() -> None:
    evaluation = evaluate_extraction(
        ROOT / "data/samples/v1_messages.jsonl",
        ROOT / "data/samples/v1_expected_quotes.jsonl",
    )

    report = format_evaluation(evaluation)

    assert "total_examples=27" in report
    assert "ticker=20/20 (100.00%)" in report
    assert "rejection_reason=7/7 (100.00%)" in report
    assert "exact_row=27/27 (100.00%)" in report
    assert "chaotic_positive_exact=7/7 (100.00%)" in report
    assert "hard_negative_exact=3/3 (100.00%)" in report
    assert "false_merge=3/3 (100.00%)" in report
