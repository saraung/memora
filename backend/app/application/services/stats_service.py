"""Aggregated platform metrics for the staff dashboards.

Returns plain dictionaries shaped to match the admin schema; every number is
computed live from the database (see ``stats_repository``).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.infrastructure.database.models.content import Post
from app.infrastructure.database.models.moderation import Report
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import stats_repository as stats


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _zero_filled_series(
    buckets: dict, *, days: int, today
) -> list[dict[str, object]]:
    points: list[dict[str, object]] = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        points.append({"date": day.isoformat(), "value": buckets.get(day, 0)})
    return points


def _rank(buckets: dict[str, int]) -> list[dict[str, object]]:
    return [
        {"key": key, "count": count}
        for key, count in sorted(
            buckets.items(), key=lambda item: (-item[1], item[0])
        )
    ]


def overview(db: Session, *, days: int = 14) -> dict[str, object]:
    """Compute the full overview payload for the last ``days`` days."""
    days = max(1, min(days, 90))
    now = _utcnow()
    today = now.date()
    since = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    since = since - timedelta(days=days - 1)

    status_counts = stats.count_accounts_by_status(db)
    report_status = stats.count_reports_by_status(db)
    report_category = stats.count_reports_by_category(db)

    return {
        "generated_at": now,
        "range_days": days,
        "accounts": {
            "total": stats.count_accounts(db),
            "active": status_counts.get("active", 0),
            "suspended": status_counts.get("suspended", 0),
            "deactivated": status_counts.get("deactivated", 0),
            "new_7d": stats.count_accounts_since(db, now - timedelta(days=7)),
            "new_30d": stats.count_accounts_since(db, now - timedelta(days=30)),
        },
        "content": {
            "posts": stats.count_posts(db),
            "reels": stats.count_reels(db),
            "stories": stats.count_stories(db),
            "comments": stats.count_comments(db),
            "messages": stats.count_messages(db),
        },
        "social": {
            "follows": stats.count_follows(db),
        },
        "reports": {
            "total": stats.count_reports(db),
            "pending": report_status.get("pending", 0),
            "under_review": report_status.get("under_review", 0),
            "action_taken": report_status.get("action_taken", 0),
            "dismissed": report_status.get("dismissed", 0),
            "last_7d": stats.count_reports_since(db, now - timedelta(days=7)),
        },
        "staff": {
            "total": len(stats.list_role_holders(db)),
            "active": stats.count_active_staff(db),
        },
        "signups_series": _zero_filled_series(
            stats.daily_series(db, User.created_at, since),
            days=days,
            today=today,
        ),
        "posts_series": _zero_filled_series(
            stats.daily_series(db, Post.created_at, since),
            days=days,
            today=today,
        ),
        "reports_series": _zero_filled_series(
            stats.daily_series(db, Report.created_at, since),
            days=days,
            today=today,
        ),
        "reports_by_category": _rank(report_category),
        "reports_by_status": _rank(report_status),
        "roles": _rank(stats.count_role_holders_all(db)),
    }
