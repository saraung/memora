"""Persistence for reports and moderation decisions."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlmodel import Session, func, select

from app.domain.enums import ModerationDecision, ReportStatus
from app.infrastructure.database.models.moderation import (
    ModerationAction,
    Report,
)


def create_report(session: Session, *, record: Report) -> Report:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_report(session: Session, report_id: uuid.UUID) -> Report | None:
    return session.get(Report, report_id)


def save_report(session: Session, record: Report) -> Report:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_reports_before(
    session: Session,
    *,
    status: ReportStatus | None,
    category: str | None,
    limit: int,
    before: tuple[datetime, uuid.UUID] | None = None,
) -> list[Report]:
    query = select(Report)
    if status is not None:
        query = query.where(Report.status == status)
    if category is not None:
        query = query.where(Report.category == category)
    if before is not None:
        created_at, report_id = before
        query = query.where(
            (Report.created_at < created_at)
            | ((Report.created_at == created_at) & (Report.id < report_id))
        )
    query = query.order_by(Report.created_at.desc(), Report.id.desc()).limit(
        limit + 1
    )
    return list(session.exec(query).all())


def count_pending(session: Session) -> int:
    return (
        session.exec(
            select(func.count())
            .select_from(Report)
            .where(Report.status == ReportStatus.PENDING)
        ).one()
        or 0
    )


def create_action(
    session: Session, *, record: ModerationAction
) -> ModerationAction:
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_actions_for_report(
    session: Session, report_id: uuid.UUID
) -> list[ModerationAction]:
    return list(
        session.exec(
            select(ModerationAction)
            .where(ModerationAction.report_id == report_id)
            .order_by(ModerationAction.created_at.desc())
        ).all()
    )


def list_actions_for_target(
    session: Session, target_type: str, target_id: str
) -> list[ModerationAction]:
    return list(
        session.exec(
            select(ModerationAction)
            .where(
                ModerationAction.target_type == target_type,
                ModerationAction.target_id == target_id,
            )
            .order_by(ModerationAction.created_at.desc())
        ).all()
    )


def list_reports_against(
    session: Session, target_type: str, target_id: str, *, limit: int = 10
) -> list[Report]:
    """Most recent reports filed against a given target."""
    return list(
        session.exec(
            select(Report)
            .where(
                Report.target_type == target_type,
                Report.target_id == target_id,
            )
            .order_by(Report.created_at.desc())
            .limit(limit)
        ).all()
    )
