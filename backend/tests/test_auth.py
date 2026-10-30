from conftest import PASSWORD, make_user


def register(client, email="new@test.com", nickname="newbie", **overrides):
    payload = {
        "email": email,
        "nickname": nickname,
        "password": PASSWORD,
        "password_confirm": PASSWORD,
    }
    payload.update(overrides)
    return client.post("/api/auth/register", json=payload)


def test_register_success(client):
    r = register(client)
    assert r.status_code in (200, 201), r.text()


def test_register_duplicate_email(client, student):
    r = register(client, email="student@test.com", nickname="other")
    assert r.status_code in (400, 409)


def test_register_duplicate_nickname(client, student):
    r = register(client, email="other@test.com", nickname="student")
    assert r.status_code in (400, 409)


def test_register_password_mismatch(client):
    r = register(client, password_confirm="Different1!")
    assert r.status_code in (400, 422)


def test_register_invalid_email(client):
    r = register(client, email="not-an-email")
    assert r.status_code == 422


def test_register_missing_fields(client):
    r = client.post("/api/auth/register", json={})
    assert r.status_code == 422


def test_login_success(client, student):
    r = client.post(
        "/api/auth/login", json={"email": "student@test.com", "password": PASSWORD}
    )
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client, student):
    r = client.post(
        "/api/auth/login", json={"email": "student@test.com", "password": "wrong"}
    )
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post(
        "/api/auth/login", json={"email": "ghost@test.com", "password": PASSWORD}
    )
    assert r.status_code == 401


def test_token_endpoint_form(client, student):
    r = client.post(
        "/api/auth/token",
        data={"username": "student@test.com", "password": PASSWORD},
    )
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_protected_without_token(client):
    assert client.get("/api/users/me").status_code == 401


def test_protected_with_garbage_token(client):
    r = client.get("/api/users/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401
