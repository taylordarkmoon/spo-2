import pytest

NEEDS_AUTH = [
    ("get", "/api/users/me"),
]


STAFF_ONLY = [
    ("get", "/api/admin/users"),
]


@pytest.mark.parametrize("method,url", NEEDS_AUTH)
def test_guest_gets_401(client, method, url):
    assert getattr(client, method)(url).status_code == 401


@pytest.mark.parametrize("method,url", STAFF_ONLY)
def test_student_gets_403(client, student, method, url):
    assert getattr(client, method)(url, headers=student).status_code == 403
