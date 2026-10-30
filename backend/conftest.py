import os
import tempfile

TEST_DB = "postgresql+psycopg://shpora:shpora@localhost:5433/spora_test"
os.environ["DATABASE_URL"] = TEST_DB
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="shpora_media_")
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.main import app
from app.database import Base, engine, get_db, SessionLocal
from app.seed import run_seed

assert settings.DATABASE_URL.endswith("_test")

PASSWORD = "Passw0rd!"


@pytest.fixture(scope="session", autouse=True)
def prepare_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as s:
        run_seed(s)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    conn = engine.connect()
    tx = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    tx.rollback()
    conn.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _auth(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()["access_token"]}"}


def make_user(client, email, nickname):
    r = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "nickname": nickname,
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        },
    )
    assert r.status_code in (200, 201), r.text
    return _auth(client, email, PASSWORD)


@pytest.fixture
def student(client):
    return make_user(client, "student@test.com", "student")


@pytest.fixture
def student2(client):
    return make_user(client, "student2@test.com", "student2")


@pytest.fixture
def moderator(client):
    headers = make_user(client, "moderator@test.com", "moderator")
    from app.models import User

    db.query(User).filter_by(email="moderator@test.com").one().role = "moderator"
    db.commit()
    return headers


@pytest.fixture
def admin(client):
    return _auth(client, settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
