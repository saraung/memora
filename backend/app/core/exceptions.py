from typing import Any


class MemoraException(Exception):
    """Base exception for expected application errors."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "APPLICATION_ERROR",
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

        super().__init__(message)


class ResourceNotFoundError(MemoraException):
    """Raised when a requested resource does not exist."""

    def __init__(
        self,
        message: str = "Resource not found",
        *,
        code: str = "RESOURCE_NOT_FOUND",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=404,
        )


class ConflictError(MemoraException):
    """Raised when an operation conflicts with existing data."""

    def __init__(
        self,
        message: str = "Resource already exists",
        *,
        code: str = "RESOURCE_CONFLICT",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=409,
        )


class UnauthorizedError(MemoraException):
    """Raised when authentication is required or invalid."""

    def __init__(
        self,
        message: str = "Authentication required",
        *,
        code: str = "UNAUTHORIZED",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=401,
        )


class ForbiddenError(MemoraException):
    """Raised when a user lacks permission for an operation."""

    def __init__(
        self,
        message: str = "You do not have permission to perform this action",
        *,
        code: str = "FORBIDDEN",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=403,
        )


class ValidationError(MemoraException):
    """Raised when business-level validation fails."""

    def __init__(
        self,
        message: str = "Validation failed",
        *,
        code: str = "VALIDATION_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=422,
            details=details,
        )


class InvalidCredentialsError(MemoraException):
    """Raised when login credentials are wrong."""

    def __init__(
        self,
        message: str = "Invalid email or password",
        *,
        code: str = "INVALID_CREDENTIALS",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=401,
        )


class TokenError(MemoraException):
    """Raised when a session/token operation fails."""

    def __init__(
        self,
        message: str = "Invalid or expired token",
        *,
        code: str = "INVALID_TOKEN",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=401,
        )


class AccountInactiveError(MemoraException):
    """Raised when an account cannot authenticate due to its status."""

    def __init__(
        self,
        message: str = "This account is not active",
        *,
        code: str = "ACCOUNT_INACTIVE",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=403,
        )


class MediaError(MemoraException):
    """Raised when an upload or media operation is invalid."""

    def __init__(
        self,
        message: str = "Invalid media operation",
        *,
        code: str = "MEDIA_ERROR",
        status_code: int = 400,
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=status_code,
        )


class StorageUnavailableError(MemoraException):
    """Raised when media storage is not configured."""

    def __init__(
        self,
        message: str = "Media storage is not configured",
        *,
        code: str = "STORAGE_UNAVAILABLE",
    ) -> None:
        super().__init__(
            message,
            code=code,
            status_code=503,
        )
