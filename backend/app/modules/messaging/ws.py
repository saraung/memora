"""WebSocket gateway: authenticated, per-conversation subscriptions.

Clients connect with `?ticket=<access-token>`, then send:
  {"action": "subscribe", "conversation_id": "<uuid>"}
  {"action": "unsubscribe", "conversation_id": "<uuid>"}
  {"action": "ping"}
  {"action": "typing", "conversation_id": "<uuid>"}
  {"action": "call:invite", "call_id": "<uuid>", "sdp": "..."}
  {"action": "call:answer", "call_id": "<uuid>", "sdp": "..."}
  {"action": "call:ice-candidate", "call_id": "<uuid>", "candidate": {...}}
  {"action": "call:decline", "call_id": "<uuid>"}
  {"action": "call:end", "call_id": "<uuid>"}

The server replies with `subscribed`/`unsubscribed`/`pong` frames and
pushes `{"type": "message", ...}` frames for subscribed conversations.
Typing and call-signaling events are forwarded to other subscribers of
the same conversation. Missed messages are recovered via the HTTP history
endpoint.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from app.application.services import auth_service, call_service
from app.core.logging import get_logger
from app.core.security import decode_access_token
from app.infrastructure.database.repositories import (
    call_repository,
    messaging_repository,
    user_repository,
)
from app.infrastructure.database.session import get_session
from app.infrastructure.realtime.hub import hub

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


logger = get_logger(__name__)


@router.websocket("/api/v1/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    ticket: str | None = Query(default=None),
    db: Session = Depends(get_session),
) -> None:
    await websocket.accept()
    try:
        payload = decode_access_token(ticket or "")
        user_id = uuid.UUID(str(payload["sub"]))
    except Exception:  # noqa: BLE001 - any auth failure closes the socket
        await websocket.close(code=4401)
        return

    try:
        try:
            user = auth_service.get_user_or_raise(db, user_id)
        except Exception:  # noqa: BLE001
            await websocket.close(code=4401)
            return

        # Mark the user as seen on socket connect.
        user.last_seen_at = _utcnow()
        user_repository.save(db, user)

        try:
            while True:
                data = await websocket.receive_json()
                action = data.get("action")
                if action == "ping":
                    await websocket.send_json({"type": "pong"})
                elif action == "typing":
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                    except (ValueError, AttributeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    user.last_seen_at = _utcnow()
                    user_repository.save(db, user)
                    await hub.broadcast(
                        conversation_id,
                        {
                            "type": "typing",
                            "conversation_id": str(conversation_id),
                            "sender_id": str(user.id),
                        },
                    )
                elif action == "call:invite":
                    logger.debug(
                        "WS call:invite from user=%s conversation=%s",
                        user.id,
                        data.get("conversation_id"),
                    )
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                        call_id = uuid.UUID(str(data.get("call_id")))
                    except (ValueError, AttributeError, TypeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        logger.debug(
                            "WS call:invite FORBIDDEN user=%s conversation=%s",
                            user.id,
                            conversation_id,
                        )
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    call = call_repository.get_call_by_id(db, call_id)
                    if (
                        call is None
                        or call.status != call_service.CallStatus.RINGING
                        or call.caller_id != user.id
                        or call.conversation_id != conversation_id
                    ):
                        logger.debug(
                            "WS call:invite INVALID_CALL user=%s call=%s conversation=%s",
                            user.id,
                            call_id,
                            conversation_id,
                        )
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_CALL"}
                        )
                        continue
                    user.last_seen_at = _utcnow()
                    user_repository.save(db, user)
                    logger.debug(
                        "WS call:invite broadcast conversation=%s from=%s call=%s",
                        conversation_id,
                        user.id,
                        call_id,
                    )
                    await hub.broadcast(
                        conversation_id,
                        {
                            "type": "call:invite",
                            "call_id": str(call_id),
                            "conversation_id": str(conversation_id),
                            "from": str(user.id),
                            "sdp": data.get("sdp"),
                        },
                    )
                elif action == "call:answer":
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                        call_id = uuid.UUID(str(data.get("call_id")))
                    except (ValueError, AttributeError, TypeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    call = call_repository.get_call_by_id(db, call_id)
                    if (
                        call is None
                        or call.status
                        not in (
                            call_service.CallStatus.RINGING,
                            call_service.CallStatus.ACCEPTED,
                        )
                        or call.callee_id != user.id
                        or call.conversation_id != conversation_id
                    ):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_CALL"}
                        )
                        continue
                    # HTTP answer may already have accepted the call; only
                    # transition it when still ringing so this is idempotent.
                    if call.status == call_service.CallStatus.RINGING:
                        call_service.answer_call(db, call_id=call_id, user=user)
                    user.last_seen_at = _utcnow()
                    user_repository.save(db, user)
                    await hub.broadcast(
                        conversation_id,
                        {
                            "type": "call:answer",
                            "call_id": str(call_id),
                            "conversation_id": str(conversation_id),
                            "from": str(user.id),
                            "sdp": data.get("sdp"),
                        },
                    )
                elif action == "call:ice-candidate":
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                        call_id = uuid.UUID(str(data.get("call_id")))
                    except (ValueError, AttributeError, TypeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    call = call_repository.get_call_by_id(db, call_id)
                    if (
                        call is None
                        or call.conversation_id != conversation_id
                        or user.id not in (call.caller_id, call.callee_id)
                    ):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_CALL"}
                        )
                        continue
                    user.last_seen_at = _utcnow()
                    user_repository.save(db, user)
                    await hub.broadcast(
                        conversation_id,
                        {
                            "type": "call:ice-candidate",
                            "call_id": str(call_id),
                            "conversation_id": str(conversation_id),
                            "from": str(user.id),
                            "candidate": data.get("candidate"),
                        },
                    )
                elif action == "call:decline":
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                        call_id = uuid.UUID(str(data.get("call_id")))
                    except (ValueError, AttributeError, TypeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    call = call_repository.get_call_by_id(db, call_id)
                    if (
                        call is None
                        or call.status
                        not in (
                            call_service.CallStatus.RINGING,
                            call_service.CallStatus.DECLINED,
                        )
                        or call.callee_id != user.id
                        or call.conversation_id != conversation_id
                    ):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_CALL"}
                        )
                        continue
                    # HTTP decline may already have declined the call; only
                    # transition it when still ringing so this is idempotent.
                    if call.status == call_service.CallStatus.RINGING:
                        call_service.decline_call(db, call_id=call_id, user=user)
                    user.last_seen_at = _utcnow()
                    user_repository.save(db, user)
                    await hub.broadcast(
                        conversation_id,
                        {
                            "type": "call:decline",
                            "call_id": str(call_id),
                            "conversation_id": str(conversation_id),
                            "from": str(user.id),
                        },
                    )
                elif action == "call:end":
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                        call_id = uuid.UUID(str(data.get("call_id")))
                    except (ValueError, AttributeError, TypeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    call = call_repository.get_call_by_id(db, call_id)
                    if (
                        call is None
                        or call.conversation_id != conversation_id
                        or user.id not in (call.caller_id, call.callee_id)
                    ):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_CALL"}
                        )
                        continue
                    duration = int(data.get("duration_seconds") or 0)
                    call_service.end_call(
                        db, call_id=call_id, user=user, duration_seconds=duration
                    )
                    user.last_seen_at = _utcnow()
                    user_repository.save(db, user)
                    await hub.broadcast(
                        conversation_id,
                        {
                            "type": "call:end",
                            "call_id": str(call_id),
                            "conversation_id": str(conversation_id),
                            "from": str(user.id),
                            "duration_seconds": duration,
                        },
                    )
                elif action in ("subscribe", "unsubscribe"):
                    try:
                        conversation_id = uuid.UUID(
                            str(data.get("conversation_id"))
                        )
                    except (ValueError, AttributeError):
                        await websocket.send_json(
                            {"type": "error", "code": "INVALID_ID"}
                        )
                        continue
                    member = (
                        messaging_repository.get_active_participant(
                            db, conversation_id, user.id
                        )
                        is not None
                    )
                    if not member:
                        await websocket.send_json(
                            {"type": "error", "code": "FORBIDDEN"}
                        )
                        continue
                    if action == "subscribe":
                        hub.subscribe(conversation_id, websocket)
                        await websocket.send_json(
                            {
                                "type": "subscribed",
                                "conversation_id": str(conversation_id),
                            }
                        )
                    else:
                        hub.unsubscribe_from(conversation_id, websocket)
                        await websocket.send_json(
                            {
                                "type": "unsubscribed",
                                "conversation_id": str(conversation_id),
                            }
                        )
                else:
                    await websocket.send_json(
                        {"type": "error", "code": "UNKNOWN_ACTION"}
                    )
        except WebSocketDisconnect:
            pass
    finally:
        # Mark last seen on disconnect and clean up subscriptions.
        try:
            user.last_seen_at = _utcnow()
            user_repository.save(db, user)
        except Exception:  # noqa: BLE001 - db may already be closed
            pass
        hub.unsubscribe(websocket)
