from cuid2 import Cuid
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from slugify import slugify

_cuid = Cuid(length=24)


def generate_cuid() -> str:
    return _cuid.generate()


class UserManager(BaseUserManager):
    def create_user(self, username: str | None = None, **extra_fields):
        user = self.model(username=username or None, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(username, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Application user. Primary key is a cuid2 string. Passkey-only auth."""

    id = models.CharField(
        primary_key=True,
        max_length=32,
        default=generate_cuid,
        editable=False,
    )
    username = models.CharField(max_length=50, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"

    @property
    def slug(self) -> str:
        """Return a URL-safe slug from a username for use in URL paths."""
        return slugify(self.username) if self.username else self.id

    @property
    def get_display_name(self):
        """Return username or short id."""
        return self.username or str(self.id)[0:7]

    def __str__(self) -> str:
        return self.username or self.id


class WebAuthnCredential(models.Model):
    """Stored passkey credential for a user."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="credentials")
    credential_id = models.BinaryField(unique=True)
    public_key = models.BinaryField()
    sign_count = models.PositiveBigIntegerField(default=0)
    transports = models.JSONField(default=list, blank=True)
    name = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_credential"

    def __str__(self) -> str:
        return f"{self.user.username} — passkey {self.pk}"
