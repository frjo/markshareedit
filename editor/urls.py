from django.urls import path

from . import views

urlpatterns = [
    path("", views.document_list, name="document_list"),
    path("new/", views.document_new, name="document_new"),
    path("<str:pk>/", views.document_detail, name="document_detail"),
    path("<str:pk>/rename/", views.document_rename, name="document_rename"),
    path("<str:pk>/delete/", views.document_delete, name="document_delete"),
]
