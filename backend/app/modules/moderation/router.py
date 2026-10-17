"""Public report submission. Review lives under /admin."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.application.services import moderation_service
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import get_current_user
from app.modules.moderation import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["moderation"])


@router.post(
    "/reports",
    response_model=schemas.ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_report(
    body: schemas.ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ReportResponse:
    from app.infrastructure.database.repositories import moderation_repository

    report_id = moderation_service.submit_report(
        db,
        reporter=current_user,
        target_type=body.target_type,
        target_id=body.target_id,
        category=body.category,
        details=body.details,
        request_id=None,
    )
    record = moderation_repository.get_report(db, report_id)
    assert record is not None
    return schemas.ReportResponse(
        id=record.id,
        reporter=UserSummary.model_validate(current_user),
        target_type=record.target_type,
        target_id=record.target_id,
        category=record.category.value,
        details=record.details,
        status=record.status.value,
        assignee=None,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )
