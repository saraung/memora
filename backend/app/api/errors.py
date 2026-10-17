"""Exception handlers producing the standard PRD error envelope."""

from __future__ import annotations

import json

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

from app.core.exceptions import MemoraException
from app.core.logging import get_logger
from app.core.middleware import get_request_id

logger = get_logger(__name__)


def _json_safe(value: object) -> object:
    """Convert pydantic error details (which may hold exceptions) to JSON."""
    return json.loads(json.dumps(value, default=str))


def _envelope(
    *, code: str, message: str, details: dict, request_id: str
) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id,
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(MemoraException)
    async def _memora_handler(
        request: Request, exc: MemoraException
    ) -> JSONResponse:
        request_id = get_request_id(request)
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                request_id=request_id,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = get_request_id(request)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope(
                code="REQUEST_VALIDATION_ERROR",
                message="Request validation failed",
                details={"errors": _json_safe(exc.errors())},
                request_id=request_id,
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        request_id = get_request_id(request)
        logger.exception("Unhandled error rid=%s", request_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred",
                details={},
                request_id=request_id,
            ),
        )
