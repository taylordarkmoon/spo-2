"""Общая бизнес-логика: выборка постов, статистика пользователя, предупреждения/баны."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Ban,
    Institute,
    Like,
    Post,
    Semester,
    Subject,
    Tag,
    Teacher,
    User,
    UserWarning,
    WorkType,
)
from app.schemas import PostOut, PostPage, UserMe, UserPublic

SortMode = Literal["new", "rating"]


# ---------- Посты ----------

def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_post_filters(
    *,
    institute_id: int | None = None,
    subject_id: int | None = None,
    semester_id: int | None = None,
    work_type_id: int | None = None,
    teacher_id: int | None = None,
    q: str | None = None,
    author_id: int | None = None,
    year: int | None = None,
    tag: str | None = None,
) -> list:
    conds = []
    if year is not None:
        conds.append(Post.year == year)
    if tag and tag.strip():
        conds.append(Post.tags.any(Tag.name == tag.strip().lstrip("#").lower()))
    if institute_id is not None:
        conds.append(Post.institute_id == institute_id)
    if subject_id is not None:
        conds.append(Post.subject_id == subject_id)
    if semester_id is not None:
        conds.append(Post.semester_id == semester_id)
    if work_type_id is not None:
        conds.append(Post.work_type_id == work_type_id)
    if teacher_id is not None:
        conds.append(Post.teacher_id == teacher_id)
    if author_id is not None:
        conds.append(Post.author_id == author_id)
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        conds.append(
            or_(
                Post.comment.ilike(pattern, escape="\\"),
                Post.display_nickname.ilike(pattern, escape="\\"),
                Post.subject.has(Subject.name.ilike(pattern, escape="\\")),
                Post.teacher.has(Teacher.full_name.ilike(pattern, escape="\\")),
                Post.work_type.has(WorkType.name.ilike(pattern, escape="\\")),
                Post.tags.any(Tag.name.ilike(pattern, escape="\\")),
            )
        )
    return conds


def order_posts(stmt: Select, sort: SortMode) -> Select:
    if sort == "rating":
        return stmt.order_by(Post.likes_count.desc(), Post.created_at.desc(), Post.id.desc())
    return stmt.order_by(Post.created_at.desc(), Post.id.desc())


def liked_post_ids(db: Session, user: User | None, post_ids: list[int]) -> set[int]:
    if user is None or not post_ids:
        return set()
    rows = db.scalars(select(Like.post_id).where(Like.user_id == user.id, Like.post_id.in_(post_ids)))
    return set(rows)


def serialize_posts(db: Session, posts: list[Post], viewer: User | None) -> list[PostOut]:
    liked = liked_post_ids(db, viewer, [p.id for p in posts])
    result = []
    for p in posts:
        out = PostOut.model_validate(p)
        out.is_liked = p.id in liked
        result.append(out)
    return result


def paginate_posts(
    db: Session,
    stmt: Select,
    count_stmt: Select,
    viewer: User | None,
    limit: int,
    offset: int,
) -> PostPage:
    total = db.scalar(count_stmt) or 0
    posts = list(db.scalars(stmt.limit(limit).offset(offset)).unique().all())
    return PostPage(
        items=serialize_posts(db, posts, viewer),
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(posts) < total,
    )


def get_post_or_404(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пост не найден")
    return post


def validate_post_refs(
    db: Session,
    *,
    institute_id: int | None = None,
    subject_id: int | None = None,
    semester_id: int | None = None,
    work_type_id: int | None = None,
    teacher_id: int | None = None,
) -> None:
    checks = [
        (Institute, institute_id, "Институт"),
        (Subject, subject_id, "Предмет"),
        (Semester, semester_id, "Семестр"),
        (WorkType, work_type_id, "Тип работы"),
        (Teacher, teacher_id, "Преподаватель"),
    ]
    for model, value, title in checks:
        if value is not None and db.get(model, value) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{title} с id={value} не найден")


def set_post_tags(db: Session, post: Post, names: list[str]) -> None:
    """Заменяет теги поста, создавая недостающие записи в справочнике тегов."""
    existing = {t.name: t for t in db.scalars(select(Tag).where(Tag.name.in_(names)))} if names else {}
    tags = []
    for name in names:
        tag = existing.get(name)
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            existing[name] = tag
        tags.append(tag)
    post.tags = tags


def change_likes_count(db: Session, post_id: int, delta: int) -> int:
    db.execute(
        update(Post)
        .where(Post.id == post_id)
        .values(likes_count=func.greatest(Post.likes_count + delta, 0))
    )
    return db.scalar(select(Post.likes_count).where(Post.id == post_id)) or 0


# ---------- Пользователи ----------

def user_total_likes(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(Post.likes_count), 0)).where(Post.author_id == user_id)
    ) or 0


def user_posts_count(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count(Post.id)).where(Post.author_id == user_id)) or 0


def user_warnings_count(db: Session, user_id: int, since: datetime | None = None) -> int:
    stmt = select(func.count(UserWarning.id)).where(UserWarning.user_id == user_id)
    if since is not None:
        stmt = stmt.where(UserWarning.created_at > since)
    return db.scalar(stmt) or 0


def to_user_public(db: Session, user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        role=user.role.name,
        created_at=user.created_at,
        total_likes=user_total_likes(db, user.id),
        posts_count=user_posts_count(db, user.id),
    )


def to_user_me(db: Session, user: User) -> UserMe:
    return UserMe(
        **to_user_public(db, user).model_dump(),
        email=user.email,
        warnings_count=user_warnings_count(db, user.id),
    )


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    return user


# ---------- Баны и предупреждения ----------

def ban_user(db: Session, user: User, banned_by: User | None, is_auto: bool) -> Ban:
    user.is_banned = True
    ban = Ban(user_id=user.id, banned_by=banned_by.id if banned_by else None, is_auto=is_auto)
    db.add(ban)
    return ban


def unban_user(db: Session, user: User) -> None:
    user.is_banned = False
    now = datetime.now(timezone.utc)
    db.execute(
        update(Ban).where(Ban.user_id == user.id, Ban.unbanned_at.is_(None)).values(unbanned_at=now)
    )


def last_unban_at(db: Session, user_id: int) -> datetime | None:
    return db.scalar(select(func.max(Ban.unbanned_at)).where(Ban.user_id == user_id))


def issue_warning(db: Session, target: User, moderator: User, reason: str) -> tuple[UserWarning, int, bool]:
    """Выдаёт предупреждение. После WARNINGS_TO_AUTO_BAN предупреждений
    (считаются с момента последнего разбана) пользователь банится автоматически."""
    warning = UserWarning(user_id=target.id, moderator_id=moderator.id, reason=reason)
    db.add(warning)
    db.flush()

    count = user_warnings_count(db, target.id, since=last_unban_at(db, target.id))
    auto_banned = False
    if (
        settings.WARNINGS_TO_AUTO_BAN > 0
        and count >= settings.WARNINGS_TO_AUTO_BAN
        and not target.is_banned
    ):
        ban_user(db, target, banned_by=None, is_auto=True)
        auto_banned = True
    return warning, count, auto_banned
