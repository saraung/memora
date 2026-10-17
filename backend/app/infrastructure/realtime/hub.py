"""In-memory WebSocket fan-out hub.

Tracks which sockets subscribe to which conversations and broadcasts
new-message payloads. History stays in PostgreSQL: clients resync via
the HTTP history endpoint after reconnects, so the hub holds no state
worth persisting (multi-process broadcast is a documented follow-up).
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionHub:
    def __init__(self) -> None:
        self._rooms: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)

    def subscribe(self, conversation_id: uuid.UUID, socket: WebSocket) -> None:
        self._rooms[conversation_id].add(socket)

    def unsubscribe(self, socket: WebSocket) -> None:
        for members in self._rooms.values():
            members.discard(socket)

    def unsubscribe_from(
        self, conversation_id: uuid.UUID, socket: WebSocket
    ) -> None:
        members = self._rooms.get(conversation_id)
        if members is not None:
            members.discard(socket)
            if not members:
                del self._rooms[conversation_id]

    def subscriber_count(self, conversation_id: uuid.UUID) -> int:
        return len(self._rooms.get(conversation_id, ()))

    async def broadcast(
        self, conversation_id: uuid.UUID, payload: dict
    ) -> None:
        subscribers = self._rooms.get(conversation_id, set())
        logger.debug(
            "WS broadcast conversation=%s subscribers=%d payload_type=%s",
            conversation_id,
            len(subscribers),
            payload.get("type"),
        )
        dead: list[WebSocket] = []
        for socket in list(subscribers):
            try:
                await socket.send_json(payload)
            except Exception:  # noqa: BLE001 - drop broken sockets
                dead.append(socket)
        for socket in dead:
            self.unsubscribe(socket)
        if dead:
            logger.info(
                "Dropped %d dead sockets for %s", len(dead), conversation_id
            )


hub = ConnectionHub()
