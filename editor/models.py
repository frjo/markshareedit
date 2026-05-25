from cuid2 import Cuid
from django.conf import settings
from django.db import models

_cuid = Cuid(length=24)


def generate_cuid() -> str:
    return _cuid.generate()


class Document(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=32,
        default=generate_cuid,
        editable=False,
    )
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "editor_document"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.title
