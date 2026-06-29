from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from otc_to_book.api.main import MAX_REPLAY_UPLOAD_BYTES, app


@pytest.fixture(autouse=True)
def reset_pipeline_state() -> None:
    if hasattr(app.state, "pipeline"):
        del app.state.pipeline


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_replay_endpoint_allows_local_web_origin() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/samples/replay",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"


def test_websocket_user_message_flow() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "event_type": "user_message",
                    "payload": {"broker_id": "BROKER_A", "text": "vendo petro27 7.30 5mm"},
                }
            )
            events = [websocket.receive_json() for _ in range(4)]

    assert [event["event_type"] for event in events] == [
        "message_received",
        "quote_parsed",
        "quote_event",
        "book_updated",
    ]
    assert events[-1]["payload"]["books"]["PETRO27"]["best_ask"] is not None


def test_websocket_clear_books_flow() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "event_type": "user_message",
                    "payload": {"broker_id": "BROKER_A", "text": "vendo petro27 7.30 5mm"},
                }
            )
            events = [websocket.receive_json() for _ in range(4)]
            websocket.send_json({"event_type": "book_clear", "payload": {}})
            clear_event = websocket.receive_json()

    assert events[-1]["payload"]["books"]["PETRO27"]["best_ask"] is not None
    assert clear_event["event_type"] == "book_updated"
    assert clear_event["payload"]["books"] == {}


def test_websocket_simulator_start_accepts_chaos_payload() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "event_type": "simulator_start",
                    "payload": {
                        "randomness": 3,
                        "noise_rate": 0,
                        "chaos_rate": 1,
                        "ticker_typo_rate": 1,
                        "template_noise_rate": 1,
                        "interval_ms": 1000,
                        "seed": 7,
                    },
                }
            )
            first_event = websocket.receive_json()
            websocket.send_json({"event_type": "simulator_stop", "payload": {}})

    assert first_event["event_type"] == "message_received"


def test_replay_continues_after_row_missing_text() -> None:
    payload = "\n".join(
        [
            json.dumps({"message_id": "bad-row"}),
            json.dumps(
                {
                    "message_id": "good-row",
                    "broker_id": "BROKER_A",
                    "text": "vendo petro27 7.30 5mm",
                }
            ),
        ]
    )

    with TestClient(app) as client:
        response = client.post(
            "/samples/replay",
            files={"file": ("sample.jsonl", payload, "application/jsonl")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["rejected_rows"] == 1
    assert [event["event_type"] for event in body["events"]].count("quote_rejected") >= 1
    assert body["events"][-1]["event_type"] == "book_updated"
    assert body["events"][-1]["payload"]["books"]["PETRO27"]["best_ask"] is not None


def test_replay_uses_isolated_pipeline_state_without_mutating_websocket_book() -> None:
    payload = json.dumps({"broker_id": "BROKER_A", "text": "vendo petro27 7.30 5mm"})

    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "event_type": "user_message",
                    "payload": {"broker_id": "BROKER_A", "text": "vendo vale29 7.40 3mm"},
                }
            )
            initial_events = [websocket.receive_json() for _ in range(4)]

            response = client.post(
                "/samples/replay",
                files={"file": ("sample.json", payload, "application/json")},
            )

            websocket.send_json(
                {
                    "event_type": "user_message",
                    "payload": {"broker_id": "BROKER_A", "text": "bid vale29 7.35"},
                }
            )
            next_events = [websocket.receive_json() for _ in range(4)]

    assert initial_events[-1]["payload"]["books"]["VALE29"]["best_ask"] is not None
    assert response.status_code == 200
    replay_body = response.json()
    assert replay_body["events"][-1]["payload"]["books"]["PETRO27"]["best_ask"] is not None
    websocket_book = next_events[-1]["payload"]["books"]
    assert "VALE29" in websocket_book
    assert "PETRO27" not in websocket_book


@pytest.mark.parametrize(
    ("filename", "payload", "expected_status", "detail"),
    [
        ("sample.txt", b"{}", 400, "unsupported replay file type"),
        ("sample.json", b"{", 400, "replay file could not be parsed"),
        (
            "sample.jsonl",
            b'{"text":"vendo petro27 7.30 5mm"}\n{',
            400,
            "replay file could not be parsed",
        ),
        ("sample.json", b"\xff", 400, "replay file must be utf-8"),
        ("sample.json", b"   ", 400, "replay file is empty"),
        ("sample.json", b"[]", 400, "replay file is empty"),
        ("sample.csv", b"message_id,broker_id,text\n", 400, "replay file is empty"),
        (
            "sample.json",
            b"x" * (MAX_REPLAY_UPLOAD_BYTES + 1),
            413,
            "replay file is too large",
        ),
    ],
)
def test_replay_file_level_failures_are_deterministic(
    filename: str,
    payload: bytes,
    expected_status: int,
    detail: str,
) -> None:
    with TestClient(app) as client:
        response = client.post(
            "/samples/replay",
            files={"file": (filename, payload, "application/octet-stream")},
        )

    assert response.status_code == expected_status
    assert response.json()["detail"] == detail


@pytest.mark.parametrize(
    ("filename", "payload", "content_type"),
    [
        (
            "sample.json",
            json.dumps({"broker_id": "BROKER_A", "text": "vendo petro27 7.30 5mm"}),
            "application/json",
        ),
        (
            "sample.json",
            json.dumps(
                [
                    {"broker_id": "BROKER_A", "text": "vendo petro27 7.30 5mm"},
                    {"broker_id": "BROKER_B", "text": "bid vale29 7.35"},
                ]
            ),
            "application/json",
        ),
        (
            "sample.csv",
            "message_id,broker_id,received_timestamp,text\n"
            "row-1,BROKER_A,2026-06-19T12:00:00Z,vendo petro27 7.30 5mm\n",
            "text/csv",
        ),
    ],
)
def test_replay_accepts_supported_file_formats(
    filename: str,
    payload: str,
    content_type: str,
) -> None:
    with TestClient(app) as client:
        response = client.post(
            "/samples/replay",
            files={"file": (filename, payload, content_type)},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["events"][-1]["event_type"] == "book_updated"


def test_websocket_invalid_user_message_emits_client_error_and_stays_open() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json({"event_type": "user_message", "payload": {"text": "   "}})
            error_event = websocket.receive_json()
            websocket.send_json(
                {
                    "event_type": "user_message",
                    "payload": {"broker_id": "BROKER_A", "text": "vendo petro27 7.30 5mm"},
                }
            )
            next_event = websocket.receive_json()

    assert error_event["event_type"] == "client_error"
    assert error_event["payload"]["code"] == "invalid_user_message"
    assert next_event["event_type"] == "message_received"


def test_websocket_invalid_simulator_config_emits_client_error_and_stays_open() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "event_type": "simulator_start",
                    "payload": {"randomness": 99, "interval_ms": -1},
                }
            )
            error_event = websocket.receive_json()
            websocket.send_json({"event_type": "book_clear", "payload": {}})
            clear_event = websocket.receive_json()

    assert error_event["event_type"] == "client_error"
    assert error_event["payload"]["code"] == "invalid_simulator_config"
    assert clear_event["event_type"] == "book_updated"
