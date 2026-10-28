from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import ROLE_ADMIN, ROLE_MODERATOR, ROLE_STUDENT, Ban, Post, Role, User, UserWarning
from app.schemas import AdminUserOut, AdminUserPage, BanOut, RoleChangeIn
from app.services import ban_user, get_user_or_404, unban_user

router = APIRouter(prefix="/admin", tags=["Администрирование"])

UserStatus = Literal["all", "students", "moderators", "admins", "banned"]


def _to_admin_out(db: Session, user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        role=user.role.name,
        is_banned=user.is_banned,
        created_at=user.created_at,
        warnings_count=db.scalar(select(func.count(UserWarning.id)).where(UserWarning.user_id == user.id)) or 0,
        posts_count=db.scalar(select(func.count(Post.id)).where(Post.author_id == user.id)) or 0,
    )


def _get_target(db: Session, admin: User, user_id: int) -> User:
    target = get_user_or_404(db, user_id)
    if target.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя применить действие к себе")
    if target.role.name == ROLE_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нельзя изменять другого администратора")
    return target


@router.get("/users", response_model=AdminUserPage)
def list_users(
    status_: UserStatus = Query("all", alias="status", description="all | students | moderators | admins | banned"),
    q: str | None = Query(None, max_length=100, description="Поиск по почте или никнейму"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Просмотр пользователей: все / модераторы / заблокированные и т.д."""
    conds = []
    if status_ == "banned":
        conds.append(User.is_banned.is_(True))
    elif status_ in ("students", "moderators", "admins"):
        role_name = {"students": ROLE_STUDENT, "moderators": ROLE_MODERATOR, "admins": ROLE_ADMIN}[status_]
        conds.append(User.role.has(Role.name == role_name))
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        conds.append(or_(User.email.ilike(pattern), User.nickname.ilike(pattern)))

    total = db.scalar(select(func.count(User.id)).where(*conds)) or 0
    users = db.scalars(
        select(User).where(*conds).order_by(User.created_at.desc(), User.id.desc()).limit(limit).offset(offset)
    ).unique().all()
    return AdminUserPage(
        items=[_to_admin_out(db, u) for u in users],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(users) < total,
    )


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return _to_admin_out(db, get_user_or_404(db, user_id))


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def change_role(
    user_id: int,
    data: RoleChangeIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Назначить модератором (`moderator`) или снять с модераторов (`student`)."""
    target = _get_target(db, admin, user_id)
    role = db.scalar(select(Role).where(Role.name == data.role))
    target.role = role
    db.commit()
    return _to_admin_out(db, target)


@router.post("/users/{user_id}/ban", response_model=AdminUserOut)
def ban(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Заблокировать пользователя (не сможет войти, его токены перестают работать)."""
    target = _get_target(db, admin, user_id)
    if target.is_banned:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь уже заблокирован")
    ban_user(db, target, banned_by=admin, is_auto=False)
    db.commit()
    return _to_admin_out(db, target)


@router.post("/users/{user_id}/unban", response_model=AdminUserOut)
def unban(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Разблокировать пользователя."""
    target = _get_target(db, admin, user_id)
    if not target.is_banned:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь не заблокирован")
    unban_user(db, target)
    db.commit()
    return _to_admin_out(db, target)


@router.get("/users/{user_id}/bans", response_model=list[BanOut])
def ban_history(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """История банов пользователя (ручных и автоматических)."""
    get_user_or_404(db, user_id)
    return db.scalars(select(Ban).where(Ban.user_id == user_id).order_by(Ban.banned_at.desc())).all()
