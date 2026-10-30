def test_me(client, student):
    r = client.get("/api/users/me", headers=student)
    assert r.status_code == 200
    assert r.json()["email"] == "student@test.com"
