"""ORM-модели. Повторяют ER-диаграмму проекта."""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Table,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

ROLE_STUDENT = "student"
ROLE_MODERATOR = "moderator"
ROLE_ADMIN = "admin"
ALL_ROLES = (ROLE_STUDENT, ROLE_MODERATOR, ROLE_ADMIN)


# ---------- Пользователи и роли ----------

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    role: Mapped[Role] = relationship(lazy="joined")

    @property
    def role_name(self) -> str:
        return self.role.name


class Ban(Base):
    __tablename__ = "bans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    banned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_auto: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    banned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    unbanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserWarning(Base):
    __tablename__ = "warnings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    moderator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    moderator: Mapped[User | None] = relationship(foreign_keys=[moderator_id], lazy="joined")


# ---------- Справочники ----------

class Institute(Base):
    __tablename__ = "institutes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)


class Semester(Base):
    __tablename__ = "semesters"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[int] = mapped_column(SmallInteger, unique=True)


class WorkType(Base):
    __tablename__ = "work_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)


class Teacher(Base):
    __tablename__ = "teachers"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), unique=True)


# ---------- Теги ----------

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True)


post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True),
)


# ---------- Посты ----------

def current_year() -> int:
    return datetime.now(timezone.utc).year


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    display_nickname: Mapped[str] = mapped_column(String(32))
    comment: Mapped[str] = mapped_column(String(200), default="", server_default="")
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id", ondelete="RESTRICT"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="RESTRICT"), index=True)
    semester_id: Mapped[int] = mapped_column(ForeignKey("semesters.id", ondelete="RESTRICT"), index=True)
    work_type_id: Mapped[int] = mapped_column(ForeignKey("work_types.id", ondelete="RESTRICT"), index=True)
    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    year: Mapped[int] = mapped_column(
        SmallInteger,
        default=current_year,
        server_default=text("EXTRACT(YEAR FROM now())::smallint"),
        index=True,
    )
    likes_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author: Mapped[User] = relationship(lazy="joined")
    institute: Mapped[Institute] = relationship(lazy="joined")
    subject: Mapped[Subject] = relationship(lazy="joined")
    semester: Mapped[Semester] = relationship(lazy="joined")
    work_type: Mapped[WorkType] = relationship(lazy="joined")
    teacher: Mapped[Teacher | None] = relationship(lazy="joined")
    tags: Mapped[list[Tag]] = relationship(secondary=post_tags, lazy="selectin", order_by=Tag.name)
    files: Mapped[list["PostFile"]] = relationship(
        back_populates="post", lazy="selectin", cascade="all, delete-orphan", order_by="PostFile.id"
    )

    __table_args__ = (
        Index("ix_posts_created_at", "created_at"),
        Index("ix_posts_likes_count", "likes_count"),
    )


class PostFile(Base):
    __tablename__ = "post_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    file_url: Mapped[str] = mapped_column(String(500))
    file_kind: Mapped[str] = mapped_column(String(20))

    post: Mapped[Post] = relationship(back_populates="files")


class Like(Base):
    __tablename__ = "likes"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    """Refresh-токены. В базе хранится только SHA-256 хэш токена, сам токен знает лишь клиент.
    Одна строка = одна сессия (устройство). При обновлении строка заменяется новой."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
