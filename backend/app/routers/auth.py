from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ROLE_STUDENT, Role, User
from app.schemas import LoginIn, RegisterIn, TokenOut
from app.security import create_access_token, hash_password, verify_password
from app.services import to_user_me

router = APIRouter(prefix="/auth", tags=["Регистрация и вход"])


def _token_response(db: Session, user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.role.name),
        user=to_user_me(db, user),
    )


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
    return _token_response(db, user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Вход по почте и паролю (JSON) — для фронтенда."""
    user = _authenticate(db, data.email, data.password)
    return _token_response(db, user)


@router.post("/token", response_model=TokenOut, include_in_schema=True)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Вход через форму OAuth2 (кнопка Authorize в Swagger). В поле username — почта."""
    user = _authenticate(db, form.username, form.password)
    return _token_response(db, user)
