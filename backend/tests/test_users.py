def test_me(client, student):
    r = client.get("/api/users/me", headers=student)
    assert r.status_code == 200
    assert r.json()["email"] == "student@test.com"


def test_admin_can_list_users(client, admin):
    r = client.get("/api/admin/users", headers=admin)
    assert r.status_code == 200


def test_student_cannot_list_users(client, student):
    r = client.get("/api/admin/users", headers=student)
    assert r.status_code == 403


def test_moderator_has_role(client, moderator):
    r = client.get("/api/users/me", headers=moderator)
    print(r.json()["role"])
    assert r.json()["role"] == "moderator"


def test_rollback_between_tests(client, student):
    r = client.get("/api/users/me", headers=student)
    assert r.status_code == 200
