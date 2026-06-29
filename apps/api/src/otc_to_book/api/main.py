from __future__ import annotations

import asyncio
import csv
import json
from io import StringIO
from pathlib import PurePath
from typing import Any, Literal
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from otc_to_book.application.pipeline import QuotePipeline
from otc_to_book.domain.models import RawMessage, RejectionReason, utc_now
from otc_to_book.simulator.generator import ChatMessageGenerator, SimulatorConfig

app = FastAPI(title="OTC-to-Book API", version="0.1.0")
SAMPLE_FILE = File(...)
MAX_REPLAY_UPLOAD_BYTES = 20_000_000
SUPPORTED_REPLAY_SUFFIXES = {".csv", ".json", ".jsonl"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ClientEventEnvelope(BaseModel):
    event_type: Literal["user_message", "simulator_start", "simulator_stop", "book_clear"]
    payload: dict[str, Any] = Field(default_factory=dict)


class UserMessagePayload(BaseModel):
    broker_id: str = "USER"
    text: str = Field(min_length=1)


class SimulatorStartPayload(BaseModel):
    randomness: int = Field(default=3, ge=1, le=5)
    noise_rate: float = Field(default=0.2, ge=0, le=1)
    chaos_rate: float = Field(default=0, ge=0, le=1)
    ticker_typo_rate: float = Field(default=0, ge=0, le=1)
    template_noise_rate: float = Field(default=0, ge=0, le=1)
    interval_ms: int = Field(default=1000, ge=50)
    broker_ids: tuple[str, ...] = ("BROKER_A", "BROKER_B", "BROKER_C")
    seed: int | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/samples/replay")
async def replay_samples(file: UploadFile = SAMPLE_FILE) -> dict[str, Any]:
    pipeline = QuotePipeline()
    replay_id = str(uuid4())
    raw_content = await file.read(MAX_REPLAY_UPLOAD_BYTES + 1)
    if len(raw_content) > MAX_REPLAY_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="replay file is too large")
    try:
        content = raw_content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="replay file must be utf-8") from exc
    rows = _parse_sample_rows(file.filename or "", content)
    all_events = []
    rejected_rows = 0

    for index, row in enumerate(rows, start=1):
        raw_message, row_reasons = _raw_message_from_replay_row(row, replay_id, index)
        if row_reasons:
            rejected_rows += 1
            events = pipeline.reject_message(
                raw_message,
                row_reasons,
                correlation_id=str(uuid4()),
            )
        else:
            events = pipeline.process_message(raw_message, correlation_id=str(uuid4()))
        all_events.extend(event.model_dump(mode="json") for event in events)

    return {"replay_id": replay_id, "events": all_events, "rejected_rows": rejected_rows}


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
            try:
                message = ClientEventEnvelope.model_validate(await websocket.receive_json())
            except ValidationError as exc:
                await send_events(
                    [
                        pipeline.client_error(
                            code="invalid_client_event",
                            message=_validation_message(exc),
                        )
                    ]
                )
                continue

            event_type = message.event_type
            payload = message.payload

            if event_type == "user_message":
                try:
                    user_message = UserMessagePayload.model_validate(payload)
                except ValidationError as exc:
                    await send_events(
                        [
                            pipeline.client_error(
                                code="invalid_user_message",
                                message=_validation_message(exc),
                            )
                        ]
                    )
                    continue
                raw_message = RawMessage(
                    message_id=str(uuid4()),
                    broker_id=user_message.broker_id,
                    received_timestamp=utc_now(),
                    text=user_message.text.strip(),
                )
                if not raw_message.text:
                    await send_events(
                        [
                            pipeline.client_error(
                                code="invalid_user_message",
                                message=(
                                    "payload.text: String should have at least "
                                    "1 non-whitespace character"
                                ),
                            )
                        ]
                    )
                    continue
                events = pipeline.process_message(raw_message, correlation_id=str(uuid4()))
                await send_events(events)
            elif event_type == "simulator_start":
                try:
                    simulator_payload = SimulatorStartPayload.model_validate(payload)
                    config = SimulatorConfig(
                        randomness=simulator_payload.randomness,
                        noise_rate=simulator_payload.noise_rate,
                        chaos_rate=simulator_payload.chaos_rate,
                        ticker_typo_rate=simulator_payload.ticker_typo_rate,
                        template_noise_rate=simulator_payload.template_noise_rate,
                        broker_ids=simulator_payload.broker_ids,
                        seed=simulator_payload.seed,
                    )
                except (ValidationError, ValueError) as exc:
                    await send_events(
                        [
                            pipeline.client_error(
                                code="invalid_simulator_config",
                                message=_error_message(exc),
                            )
                        ]
                    )
                    continue
                if simulator_task is not None:
                    simulator_task.cancel()
                simulator_task = asyncio.create_task(
                    run_simulator(config, simulator_payload.interval_ms)
                )
            elif event_type == "simulator_stop":
                if simulator_task is not None:
                    simulator_task.cancel()
                    simulator_task = None
            elif event_type == "book_clear":
                await send_events([pipeline.clear_books(correlation_id=str(uuid4()))])
    except WebSocketDisconnect:
        if simulator_task is not None:
            simulator_task.cancel()


def _pipeline() -> QuotePipeline:
    if not hasattr(app.state, "pipeline"):
        app.state.pipeline = QuotePipeline()
    return app.state.pipeline


def _parse_sample_rows(filename: str, content: str) -> list[Any]:
    suffix = PurePath(filename).suffix.lower()
    if suffix not in SUPPORTED_REPLAY_SUFFIXES:
        raise HTTPException(status_code=400, detail="unsupported replay file type")
    stripped = content.strip()
    if not stripped:
        raise HTTPException(status_code=400, detail="replay file is empty")

    try:
        if suffix == ".csv":
            rows = list(csv.DictReader(StringIO(content), strict=True))
            if not rows:
                raise HTTPException(status_code=400, detail="replay file is empty")
            return rows

        if suffix == ".jsonl":
            rows = [json.loads(line) for line in stripped.splitlines()]
            if not rows:
                raise HTTPException(status_code=400, detail="replay file is empty")
            return rows

        parsed = json.loads(stripped)
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail="replay file could not be parsed") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="replay file could not be parsed") from exc

    if isinstance(parsed, list):
        if not parsed:
            raise HTTPException(status_code=400, detail="replay file is empty")
        return parsed
    return [parsed]


def _raw_message_from_replay_row(
    row: Any,
    replay_id: str,
    index: int,
) -> tuple[RawMessage, tuple[RejectionReason, ...]]:
    if not isinstance(row, dict):
        return (
            _fallback_replay_message(replay_id, index, ""),
            (RejectionReason.UNSUPPORTED_TEMPLATE,),
        )

    text = row.get("text")
    reasons: list[RejectionReason] = []
    try:
        raw_message = RawMessage(
            message_id=str(row.get("message_id") or f"{replay_id}-{index}"),
            broker_id=str(row.get("broker_id") or "USER"),
            received_timestamp=row.get("received_timestamp") or utc_now(),
            text=str(text or ""),
            replay_id=replay_id,
            replay_sequence=index,
        )
    except ValueError:
        raw_message = RawMessage(
            message_id=str(row.get("message_id") or f"{replay_id}-{index}"),
            broker_id=str(row.get("broker_id") or "USER"),
            received_timestamp=utc_now(),
            text=str(text or ""),
            replay_id=replay_id,
            replay_sequence=index,
        )
        reasons.append(RejectionReason.INVALID_TIMESTAMP)
    if not isinstance(text, str) or not text.strip():
        reasons.append(RejectionReason.UNSUPPORTED_TEMPLATE)
    return raw_message, tuple(reasons)


def _fallback_replay_message(replay_id: str, index: int, text: str) -> RawMessage:
    return RawMessage(
        message_id=f"{replay_id}-{index}",
        broker_id="USER",
        received_timestamp=utc_now(),
        text=text,
        replay_id=replay_id,
        replay_sequence=index,
    )


def _validation_message(error: ValidationError) -> str:
    first_error = error.errors()[0]
    location = ".".join(str(part) for part in first_error.get("loc", ())) or "payload"
    return f"{location}: {first_error.get('msg', 'invalid value')}"


def _error_message(error: Exception) -> str:
    if isinstance(error, ValidationError):
        return _validation_message(error)
    return str(error)
