"""Мини-миграции: проект без Alembic, а `create_all` не добавляет колонки в уже существующие таблицы.
Все выражения идемпотентны и выполняются при каждом старте."""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

log = logging.getLogger("migrations")

STATEMENTS = [
    # год материалов (фильтр «дата: год + семестр»); у старых постов — год добавления колонки
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS year SMALLINT NOT NULL DEFAULT (EXTRACT(YEAR FROM now())::smallint)",
    "CREATE INDEX IF NOT EXISTS ix_posts_year ON posts (year)",
]


def run_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
    log.info("Миграции применены")
