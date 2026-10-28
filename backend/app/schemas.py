import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

NICKNAME_RE = re.compile(r"^[A-Za-zА-Яа-яЁё0-9_.\-]{3,32}$")


def _check_nickname(v: str) -> str:
    v = v.strip()
    if not NICKNAME_RE.match(v):
        raise ValueError("Никнейм: 3–32 символа, буквы, цифры, «_», «.», «-»")
    return v


# ---------- Общие ----------

class Message(BaseModel):
    detail: str


class DictItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class SemesterItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    number: int


class TeacherItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


# ---------- Auth ----------

class RegisterIn(BaseModel):
    email: EmailStr
    nickname: str
    password: str = Field(min_length=6, max_length=72)
    password_confirm: str

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str) -> str:
        return _check_nickname(v)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Пароли не совпадают")
        return self


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.strip().lower()


# ---------- Пользователи ----------

class UserShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nickname: str
    avatar_url: str | None


class UserPublic(UserShort):
    role: str
    created_at: datetime
    total_likes: int = 0
    posts_count: int = 0


class UserMe(UserPublic):
    email: str
    warnings_count: int = 0


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe


class UserUpdate(BaseModel):
    nickname: str | None = None

    @field_validator("nickname")
    @classmethod
    def _nick(cls, v: str | None) -> str | None:
        return None if v is None else _check_nickname(v)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=72)
    new_password_confirm: str

    @model_validator(mode="after")
    def _match(self):
        if self.new_password != self.new_password_confirm:
            raise ValueError("Пароли не совпадают")
        return self


# ---------- Посты ----------

class PostFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    file_url: str
    file_kind: str


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author: UserShort
    display_nickname: str
    comment: str
    institute: DictItem
    subject: DictItem
    semester: SemesterItem
    work_type: DictItem
    teacher: TeacherItem | None
    files: list[PostFileOut]
    likes_count: int
    is_liked: bool = False
    created_at: datetime
    updated_at: datetime


class PostPage(BaseModel):
    items: list[PostOut]
    total: int
    limit: int
    offset: int
    has_more: bool


class PostCreate(BaseModel):
    comment: str = Field(default="", max_length=200)
    institute_id: int
    subject_id: int
    semester_id: int
    work_type_id: int
    teacher_id: int | None = None


class PostUpdate(BaseModel):
    comment: str | None = Field(default=None, max_length=200)
    institute_id: int | None = None
    subject_id: int | None = None
    semester_id: int | None = None
    work_type_id: int | None = None
    teacher_id: int | None = None  # передайте null явно, чтобы убрать преподавателя


class LikeOut(BaseModel):
    post_id: int
    liked: bool
    likes_count: int


# ---------- Модерация ----------

class ModerationDeleteIn(BaseModel):
    is_violation: bool = False
    comment: str | None = Field(default=None, max_length=500)


class ModerationDeleteOut(BaseModel):
    post_id: int
    is_violation: bool
    warning_issued: bool
    warnings_count: int | None = None
    auto_banned: bool = False


class WarningIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class WarningOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    moderator: UserShort | None
    reason: str
    created_at: datetime


class WarningResult(BaseModel):
    warning: WarningOut
    warnings_count: int
    auto_banned: bool


# ---------- Администрирование ----------

class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    nickname: str
    avatar_url: str | None
    role: str
    is_banned: bool
    created_at: datetime
    warnings_count: int = 0
    posts_count: int = 0


class AdminUserPage(BaseModel):
    items: list[AdminUserOut]
    total: int
    limit: int
    offset: int
    has_more: bool


class RoleChangeIn(BaseModel):
    role: Literal["student", "moderator"]


class BanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    banned_by: int | None
    is_auto: bool
    banned_at: datetime
    unbanned_at: datetime | None
