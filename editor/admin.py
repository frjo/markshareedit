from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "created_by", "created_at", "updated_at")
    search_fields = ("title", "created_by__username")
    ordering = ("-updated_at",)
    readonly_fields = ("id", "created_at", "updated_at")
