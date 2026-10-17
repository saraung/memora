"""Domain enumerations. Pure Python — no framework dependencies."""

from enum import Enum


class AccountStatus(str, Enum):
    """Lifecycle state of a user account."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"
    DELETED = "deleted"


class FollowRequestStatus(str, Enum):
    """Lifecycle state of a follow request to a private account."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELED = "canceled"


class MediaStatus(str, Enum):
    """Processing state of a media asset."""

    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"


class PostStatus(str, Enum):
    """Moderation/lifecycle state of a post."""

    VISIBLE = "visible"
    REMOVED = "removed"


class StoryStatus(str, Enum):
    """Lifecycle state of a story (expiry is time-based, not a status)."""

    ACTIVE = "active"
    DELETED = "deleted"


class ReelStatus(str, Enum):
    """Moderation/lifecycle state of a reel."""

    VISIBLE = "visible"
    REMOVED = "removed"


class ConversationType(str, Enum):
    """Conversation shape. Groups deferred to a later milestone."""

    DIRECT = "direct"


class NotificationType(str, Enum):
    """Event kinds that generate user notifications."""

    FOLLOW = "follow"
    FOLLOW_REQUEST = "follow_request"
    LIKE = "like"
    COMMENT = "comment"
    MENTION = "mention"
    MESSAGE = "message"
    MODERATION = "moderation"
    SECURITY = "security"
    CALL = "call"


class CallStatus(str, Enum):
    """Lifecycle state of a voice call."""

    RINGING = "ringing"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    MISSED = "missed"
    ENDED = "ended"


class ReportStatus(str, Enum):
    """Review lifecycle of a user report."""

    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    ACTION_TAKEN = "action_taken"
    DISMISSED = "dismissed"


class ReportCategory(str, Enum):
    """Reportable violation categories."""

    SPAM = "spam"
    HARASSMENT = "harassment"
    HATE = "hate"
    NUDITY = "nudity"
    VIOLENCE = "violence"
    MISINFORMATION = "misinformation"
    SELF_HARM = "self_harm"
    COPYRIGHT = "copyright"
    OTHER = "other"


class ModerationDecision(str, Enum):
    """Actions a moderator can apply to a report."""

    DISMISS = "dismiss"
    REMOVE_CONTENT = "remove_content"
    WARN = "warn"
    RESTRICT = "restrict"
    SUSPEND = "suspend"
    UNSUSPEND = "unsuspend"
