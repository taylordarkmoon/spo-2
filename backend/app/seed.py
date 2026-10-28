"""Начальные данные: роли, первый администратор, стартовые справочники."""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ALL_ROLES, ROLE_ADMIN, Institute, Role, Semester, Subject, User, WorkType
from app.security import hash_password

log = logging.getLogger("seed")

INSTITUTES = [
    "Институт информационных технологий (ИИТ)",
    "Институт искусственного интеллекта (ИИИ)",
    "Институт кибербезопасности и цифровых технологий (ИКБ)",
    "Институт радиоэлектроники и информатики (ИРИ)",
    "Институт перспективных технологий и индустриального программирования (ИПТИП)",
    "Институт технологий управления (ИТУ)",
    "Институт тонких химических технологий (ИТХТ)",
]

SUBJECTS = [
    "Математический анализ",
    "Линейная алгебра",
    "Дискретная математика",
    "Программирование",
    "Базы данных",
    "Физика",
    "Экономика",
    "История России",
    "Иностранный язык",
]

WORK_TYPES = [
    "Конспект лекций",
    "Шпаргалка",
    "Практическая работа",
    "Лабораторная работа",
    "Контрольная работа",
    "Курсовая работа",
    "Экзаменационные билеты",
    "Домашнее задание",
]


def _seed_names(db: Session, model, names: list[str]) -> None:
    if db.scalar(select(func.count()).select_from(model)):
        return
    db.add_all(model(name=n) for n in names)


def run_seed(db: Session) -> None:
    # Роли
    existing = set(db.scalars(select(Role.name)))
    for name in ALL_ROLES:
        if name not in existing:
            db.add(Role(name=name))
    db.flush()

    # Первый администратор
    if not db.scalar(select(User.id).where(User.email == settings.ADMIN_EMAIL.lower())):
        admin_role = db.scalar(select(Role).where(Role.name == ROLE_ADMIN))
        db.add(
            User(
                email=settings.ADMIN_EMAIL.lower(),
                nickname=settings.ADMIN_NICKNAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role=admin_role,
            )
        )
        log.info("Создан администратор %s", settings.ADMIN_EMAIL)

    # Стартовые справочники (только если таблицы пустые)
    if settings.SEED_DEMO_DATA:
        _seed_names(db, Institute, INSTITUTES)
        _seed_names(db, Subject, SUBJECTS)
        _seed_names(db, WorkType, WORK_TYPES)
        if not db.scalar(select(func.count()).select_from(Semester)):
            db.add_all(Semester(number=n) for n in range(1, 9))

    db.commit()
