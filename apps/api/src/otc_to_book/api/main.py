from __future__ import annotations

import asyncio
import csv
import json
from io import StringIO
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect

from otc_to_book.application.pipeline import QuotePipeline
from otc_to_book.domain.models import RawMessage, utc_now
from otc_to_book.simulator.generator import ChatMessageGenerator, SimulatorConfig

app = FastAPI(title="OTC-to-Book API", version="0.1.0")
SAMPLE_FILE = File(...)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/samples/replay")
async def replay_samples(file: UploadFile = SAMPLE_FILE) -> dict[str, Any]:
    pipeline = _pipeline()
    replay_id = str(uuid4())
    content = (await file.read()).decode("utf-8")
    rows = _parse_sample_rows(file.filename or "", content)
    all_events = []

    for index, row in enumerate(rows, start=1):
        raw_message = RawMessage(
            message_id=row.get("message_id") or f"{replay_id}-{index}",
            broker_id=row.get("broker_id") or "USER",
            received_timestamp=row.get("received_timestamp") or utc_now(),
            text=row["text"],
            replay_id=replay_id,
            replay_sequence=index,
        )
        all_events.extend(
            event.model_dump(mode="json")
            for event in pipeline.process_message(raw_message, correlation_id=str(uuid4()))
        )

    return {"replay_id": replay_id, "events": all_events}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    pipeline = _pipeline()
    simulator_task: asyncio.Task[None] | None = None

    async def send_events(events) -> None:
        for event in events:
            await websocket.send_json(event.model_dump(mode="json"))

    async def run_simulator(config: SimulatorConfig, interval_ms: int) -> None:
        generator = ChatMessageGenerator(config)
        while True:
            raw_message = generator.next_message()
            await send_events(pipeline.process_message(raw_message, correlation_id=str(uuid4())))
            await asyncio.sleep(interval_ms / 1000)

    try:
        while True:
            message = await websocket.receive_json()
            event_type = message.get("event_type")
            payload = message.get("payload") or {}

            if event_type == "user_message":
                raw_message = RawMessage(
                    message_id=str(uuid4()),
                    broker_id=payload.get("broker_id") or "USER",
                    received_timestamp=utc_now(),
                    text=payload["text"],
                )
                events = pipeline.process_message(raw_message, correlation_id=str(uuid4()))
                await send_events(events)
            elif event_type == "simulator_start":
                if simulator_task is not None:
                    simulator_task.cancel()
                config = SimulatorConfig(
                    randomness=int(payload.get("randomness", 3)),
                    noise_rate=float(payload.get("noise_rate", 0.2)),
                    chaos_rate=float(payload.get("chaos_rate", 0)),
                    ticker_typo_rate=float(payload.get("ticker_typo_rate", 0)),
                    template_noise_rate=float(payload.get("template_noise_rate", 0)),
                    broker_ids=tuple(
                        payload.get("broker_ids") or ("BROKER_A", "BROKER_B", "BROKER_C")
                    ),
                    seed=payload.get("seed"),
                )
                interval_ms = int(payload.get("interval_ms", 1000))
                simulator_task = asyncio.create_task(run_simulator(config, interval_ms))
            elif event_type == "simulator_stop":
                if simulator_task is not None:
                    simulator_task.cancel()
                    simulator_task = None
    except WebSocketDisconnect:
        if simulator_task is not None:
            simulator_task.cancel()


def _pipeline() -> QuotePipeline:
    if not hasattr(app.state, "pipeline"):
        app.state.pipeline = QuotePipeline()
    return app.state.pipeline


def _parse_sample_rows(filename: str, content: str) -> list[dict[str, Any]]:
    if filename.endswith(".csv"):
        return list(csv.DictReader(StringIO(content)))

    rows = []
    stripped = content.strip()
    if not stripped:
        return rows
    if filename.endswith(".jsonl"):
        for line in stripped.splitlines():
            rows.append(json.loads(line))
        return rows

    parsed = json.loads(stripped)
    if isinstance(parsed, list):
        return parsed
    return [parsed]
