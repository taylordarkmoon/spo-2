import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401  — регистрирует модели в Base.metadata
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.files import MEDIA_ROOT, ensure_media_dirs
from app.migrations import run_migrations
from app.routers import admin, auth, dictionaries, moderation, posts, tags, users
from app.seed import run_seed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")


def wait_for_db(attempts: int = 30, delay: float = 1.0) -> None:
    for i in range(attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            log.info("Жду базу данных... (%s/%s)", i + 1, attempts)
            time.sleep(delay)
    raise RuntimeError("База данных недоступна")


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    with SessionLocal() as db:
        run_seed(db)
    yield


ensure_media_dirs()

app = FastAPI(
    title="Шпора — API",
    description=(
        "Бэкенд веб-приложения, где студенты делятся шпаргалками и конспектами.\n\n"
        "Роли: гость (без токена), студент, модератор, администратор.\n"
        "Авторизация — JWT: `Authorization: Bearer <token>`."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.cors_origins_list != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (
    auth.router,
    posts.router,
    users.router,
    dictionaries.router,
    tags.router,
    moderation.router,
    admin.router,
):
    app.include_router(r, prefix="/api")

app.mount(settings.MEDIA_URL, StaticFiles(directory=MEDIA_ROOT), name="media")


@app.get("/api/health", tags=["Служебное"])
def health():
    return {"status": "ok"}
