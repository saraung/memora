"""Versioned API router."""

from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.feed.router import router as feed_router
from app.modules.follows.router import router as follows_router
from app.modules.media.router import router as media_router
from app.modules.messaging.router import router as messaging_router
from app.modules.moderation.router import router as moderation_router
from app.modules.notifications.router import router as notifications_router
from app.modules.posts.router import router as posts_router
from app.modules.search.router import router as search_router
from app.modules.stories.reels_router import router as reels_router
from app.modules.stories.router import router as stories_router
from app.modules.users.router import router as users_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth_router)
v1_router.include_router(users_router)
v1_router.include_router(follows_router)
v1_router.include_router(media_router)
v1_router.include_router(posts_router)
v1_router.include_router(search_router)
v1_router.include_router(admin_router)
v1_router.include_router(feed_router)
v1_router.include_router(stories_router)
v1_router.include_router(reels_router)
v1_router.include_router(messaging_router)
v1_router.include_router(moderation_router)
v1_router.include_router(notifications_router)
