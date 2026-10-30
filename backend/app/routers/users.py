from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, get_current_user_optional
from app.files import IMAGE_EXT, delete_media, save_upload
from app.models import Like, Post, User, UserWarning
from app.schemas import (
    PasswordChange,
    TokenOut,
    PostPage,
    UserMe,
    UserPublic,
    UserUpdate,
    WarningOut,
)
from app.security import hash_password, verify_password
from app.services import SortMode, get_user_or_404, revoke_refresh_tokens, token_response, order_posts, paginate_posts, to_user_me, to_user_public

router = APIRouter(prefix="/users", tags=["Профиль"])

AVATAR_KINDS = {ext: "image" for ext in IMAGE_EXT}


# ---------- Мой профиль ----------

@router.get("/me", response_model=UserMe)
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Профиль: никнейм, аватарка, сумма лайков под всеми постами, число постов и предупреждений."""
    return to_user_me(db, user)


@router.patch("/me", response_model=UserMe)
def update_me(data: UserUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Изменить никнейм."""
    if data.nickname is not None and data.nickname != user.nickname:
        taken = db.scalar(
            select(User.id).where(func.lower(User.nickname) == data.nickname.lower(), User.id != user.id)
        )
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, "Этот никнейм уже занят")
        user.nickname = data.nickname
        # никнейм, отображаемый в постах, тоже обновляем
        db.execute(
            update(Post).where(Post.author_id == user.id).values(display_nickname=data.nickname)
        )
        db.commit()
    return to_user_me(db, user)


@router.post("/me/avatar", response_model=UserMe)
def upload_avatar(
    file: UploadFile = File(..., description="jpg, png, webp, gif"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Загрузить/заменить аватарку."""
    url, _ = save_upload(file, "avatars", AVATAR_KINDS, settings.MAX_AVATAR_MB)
    old = user.avatar_url
    user.avatar_url = url
    db.commit()
    delete_media(old)
    return to_user_me(db, user)


@router.delete("/me/avatar", response_model=UserMe)
def delete_avatar(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    old = user.avatar_url
    user.avatar_url = None
    db.commit()
    delete_media(old)
    return to_user_me(db, user)


@router.post("/me/password", response_model=TokenOut)
def change_password(data: PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Сменить пароль. Все остальные сессии завершаются, текущему устройству выдаётся новая пара токенов."""
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неверный текущий пароль")
    user.password_hash = hash_password(data.new_password)
    revoke_refresh_tokens(db, user.id)
    return token_response(db, user)


@router.get("/me/posts", response_model=PostPage)
def my_posts(
    sort: SortMode = "new",
    limit: int = Query(6, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Мои посты."""
    stmt = order_posts(select(Post).where(Post.author_id == user.id), sort)
    count_stmt = select(func.count(Post.id)).where(Post.author_id == user.id)
    return paginate_posts(db, stmt, count_stmt, user, limit, offset)


@router.get("/me/likes", response_model=PostPage)
def my_liked_posts(
    limit: int = Query(6, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Лайкнутые посты (сначала лайкнутые последними)."""
    stmt = (
        select(Post)
        .join(Like, Like.post_id == Post.id)
        .where(Like.user_id == user.id)
        .order_by(Like.created_at.desc(), Post.id.desc())
    )
    count_stmt = select(func.count()).select_from(Like).where(Like.user_id == user.id)
    return paginate_posts(db, stmt, count_stmt, user, limit, offset)


@router.get("/me/warnings", response_model=list[WarningOut])
def my_warnings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Предупреждения, выданные мне модераторами."""
    return db.scalars(
        select(UserWarning).where(UserWarning.user_id == user.id).order_by(UserWarning.created_at.desc())
    ).all()


# ---------- Чужой профиль (доступно всем) ----------

@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return to_user_public(db, get_user_or_404(db, user_id))


@router.get("/{user_id}/posts", response_model=PostPage)
def user_posts(
    user_id: int,
    sort: SortMode = "new",
    limit: int = Query(6, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    get_user_or_404(db, user_id)
    stmt = order_posts(select(Post).where(Post.author_id == user_id), sort)
    count_stmt = select(func.count(Post.id)).where(Post.author_id == user_id)
    return paginate_posts(db, stmt, count_stmt, viewer, limit, offset)
