from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_moderator
from app.files import delete_media
from app.models import ROLE_ADMIN, ROLE_STUDENT, User, UserWarning
from app.schemas import (
    ModerationDeleteIn,
    ModerationDeleteOut,
    WarningIn,
    WarningOut,
    WarningResult,
)
from app.services import get_post_or_404, get_user_or_404, issue_warning

router = APIRouter(prefix="/moderation", tags=["Модерация"])


def _can_moderate(actor: User, target: User) -> bool:
    """Модератор работает со студентами, администратор — со всеми, кроме администраторов."""
    if target.id == actor.id:
        return False
    if actor.role.name == ROLE_ADMIN:
        return target.role.name != ROLE_ADMIN
    return target.role.name == ROLE_STUDENT


@router.post("/posts/{post_id}/delete", response_model=ModerationDeleteOut)
def moderator_delete_post(
    post_id: int,
    data: ModerationDeleteIn,
    db: Session = Depends(get_db),
    moderator: User = Depends(require_moderator),
):
    """Удалить пост. Можно отметить галочкой «нарушает правила» (`is_violation`)
    и оставить комментарий-пояснение. Пост удаляется полностью, журнал удалений не хранится.
    При нарушении автору выдаётся предупреждение с этим комментарием (таблица warnings)."""
    post = get_post_or_404(db, post_id)
    author = post.author
    urls = [f.file_url for f in post.files]
    db.delete(post)

    result = ModerationDeleteOut(post_id=post_id, is_violation=data.is_violation, warning_issued=False)
    if data.is_violation and author.id != moderator.id:
        reason = f"Пост #{post_id} удалён за нарушение правил"
        if data.comment:
            reason += f": {data.comment}"
        _, count, auto_banned = issue_warning(db, author, moderator, reason[:500])
        result.warning_issued = True
        result.warnings_count = count
        result.auto_banned = auto_banned

    db.commit()
    for url in urls:
        delete_media(url)
    return result


@router.post("/users/{user_id}/warnings", response_model=WarningResult, status_code=status.HTTP_201_CREATED)
def warn_user(
    user_id: int,
    data: WarningIn,
    db: Session = Depends(get_db),
    moderator: User = Depends(require_moderator),
):
    """Выдать предупреждение пользователю. После N предупреждений (WARNINGS_TO_AUTO_BAN) — автобан."""
    target = get_user_or_404(db, user_id)
    if not _can_moderate(moderator, target):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нельзя выдать предупреждение этому пользователю")
    warning, count, auto_banned = issue_warning(db, target, moderator, data.reason.strip())
    db.commit()
    db.refresh(warning)
    return WarningResult(
        warning=WarningOut.model_validate(warning),
        warnings_count=count,
        auto_banned=auto_banned,
    )


@router.get("/users/{user_id}/warnings", response_model=list[WarningOut])
def user_warnings(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_moderator),
):
    get_user_or_404(db, user_id)
    return db.scalars(
        select(UserWarning).where(UserWarning.user_id == user_id).order_by(UserWarning.created_at.desc())
    ).all()


@router.delete("/warnings/{warning_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_warning(
    warning_id: int,
    db: Session = Depends(get_db),
    moderator: User = Depends(require_moderator),
):
    """Отозвать ошибочно выданное предупреждение."""
    warning = db.get(UserWarning, warning_id)
    if warning is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Предупреждение не найдено")
    if warning.moderator_id != moderator.id and moderator.role.name != ROLE_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Отозвать можно только своё предупреждение")
    db.delete(warning)
    db.commit()
