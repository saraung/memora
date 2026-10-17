"""Import every table model so SQLModel.metadata is complete."""

from app.infrastructure.database.models.audit import AuditEvent  # noqa: F401
from app.infrastructure.database.models.auth import (  # noqa: F401
    EmailVerificationToken,
    PasswordResetToken,
    RefreshSession,
)
from app.infrastructure.database.models.content import (  # noqa: F401
    Bookmark,
    Comment,
    Hashtag,
    Like,
    Mention,
    Post,
    PostHashtag,
    PostMedia,
    Reel,
    ReelBookmark,
    ReelComment,
    ReelLike,
    ReelView,
    Story,
    StoryView,
)
from app.infrastructure.database.models.media import (  # noqa: F401
    MediaAsset,
    MediaUploadIntent,
)
from app.infrastructure.database.models.call import Call  # noqa: F401
from app.infrastructure.database.models.messaging import (  # noqa: F401
    Conversation,
    ConversationParticipant,
    Message,
    MessageMedia,
    MessageReceipt,
    Notification,
)
from app.infrastructure.database.models.moderation import (  # noqa: F401
    ModerationAction,
    Report,
)
from app.infrastructure.database.models.rbac import (  # noqa: F401
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from app.infrastructure.database.models.social import (  # noqa: F401
    Block,
    Follow,
    FollowRequest,
)
from app.infrastructure.database.models.user import User  # noqa: F401
