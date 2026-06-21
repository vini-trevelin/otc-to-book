from __future__ import annotations

import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
sys.path.insert(0, str(API_ROOT / "src"))

from otc_to_book.application.evaluation import evaluate_extraction, format_evaluation  # noqa: E402


def main() -> int:
    evaluation = evaluate_extraction(
        REPO_ROOT / "data/samples/v1_messages.jsonl",
        REPO_ROOT / "data/samples/v1_expected_quotes.jsonl",
    )
    print(format_evaluation(evaluation))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
