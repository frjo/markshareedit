import pytest

from accounts.models import User


@pytest.fixture(autouse=True)
def disable_ratelimit(settings):
    settings.RATELIMIT_ENABLE = False


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="otheruser")
