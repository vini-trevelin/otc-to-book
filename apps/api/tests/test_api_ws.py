from __future__ import annotations

from fastapi.testclient import TestClient

from otc_to_book.api.main import app


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


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
