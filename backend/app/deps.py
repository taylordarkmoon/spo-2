from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ROLE_ADMIN, ROLE_MODERATOR, ROLE_STUDENT, User
from app.security import decode_access_token

# auto_error=False — чтобы гость (без токена) тоже проходил на публичные эндпоинты
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Гость → None, авторизованный → User."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Недействительный или просроченный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь не найден")
    if user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ваш аккаунт заблокирован")
    return user


def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")
        return user

    return checker


# Студентские действия доступны и модераторам, и администраторам
require_student = require_roles(ROLE_STUDENT, ROLE_MODERATOR, ROLE_ADMIN)
require_moderator = require_roles(ROLE_MODERATOR, ROLE_ADMIN)
require_admin = require_roles(ROLE_ADMIN)
