from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ROLE_STUDENT, RefreshToken, Role, User
from app.schemas import LoginIn, RefreshIn, RegisterIn, TokenOut
from app.security import hash_password, hash_refresh_token, verify_password
from app.services import token_response

router = APIRouter(prefix="/auth", tags=["Регистрация и вход"])


def _authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверная почта или пароль")
    if user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ваш аккаунт заблокирован")
    return user


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    """Регистрация студента: почта (логин), никнейм, пароль + подтверждение."""
    if db.scalar(select(User.id).where(User.email == data.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с такой почтой уже существует")
    if db.scalar(select(User.id).where(func.lower(User.nickname) == data.nickname.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Этот никнейм уже занят")

    role = db.scalar(select(Role).where(Role.name == ROLE_STUDENT))
    user = User(
        email=data.email,
        nickname=data.nickname,
        password_hash=hash_password(data.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return token_response(db, user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Вход по почте и паролю (JSON) — для фронтенда."""
    user = _authenticate(db, data.email, data.password)
    return token_response(db, user)


@router.post("/token", response_model=TokenOut, include_in_schema=True)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Вход через форму OAuth2 (кнопка Authorize в Swagger). В поле username — почта."""
    user = _authenticate(db, form.username, form.password)
    return token_response(db, user)


@router.post("/refresh", response_model=TokenOut)
def refresh(data: RefreshIn, db: Session = Depends(get_db)):
    """Обменять refresh-токен на новую пару токенов (access + refresh).

    Старый refresh-токен после этого перестаёт действовать (ротация).
    401 — токен неверный или истёк: нужно войти заново."""
    session_row = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(data.refresh_token))
    )
    if session_row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Сессия недействительна, войдите заново")

    user = db.get(User, session_row.user_id)
    expired = session_row.expires_at <= datetime.now(timezone.utc)
    db.delete(session_row)
    db.commit()

    if expired or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Сессия истекла, войдите заново")
    if user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ваш аккаунт заблокирован")
    return token_response(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(data: RefreshIn, db: Session = Depends(get_db)):
    """Выйти: удалить сессию (refresh-токен). Access-токен доживёт свои минуты и истечёт сам."""
    db.execute(delete(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(data.refresh_token)))
    db.commit()
