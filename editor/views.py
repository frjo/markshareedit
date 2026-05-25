import nh3
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_POST

from .models import Document


@login_required
@require_GET
def document_list(request):
    documents = Document.objects.select_related("created_by", "updated_by").all()
    return render(request, "editor/document_list.html", {"documents": documents})


@login_required
def document_new(request):
    if request.method == "POST":
        title = nh3.clean(request.POST.get("title", "").strip(), tags=set())
        if not title:
            title = "Untitled"
        doc = Document.objects.create(title=title, created_by=request.user)
        return redirect("document_detail", pk=doc.pk)
    return render(request, "editor/document_new.html")


@login_required
@require_GET
def document_detail(request, pk):
    document = get_object_or_404(Document, pk=pk)
    ws_scheme = "wss" if request.is_secure() else "ws"
    return render(
        request,
        "editor/document_detail.html",
        {"document": document, "ws_scheme": ws_scheme},
    )


@login_required
@require_POST
def document_rename(request, pk):
    document = get_object_or_404(Document, pk=pk)
    title = nh3.clean(request.POST.get("title", "").strip(), tags=set())
    if title:
        document.title = title
        document.save(update_fields=["title"])
    if request.htmx:
        return render(request, "editor/_document_title.html", {"document": document})
    return redirect("document_detail", pk=pk)


@login_required
@require_POST
def document_delete(request, pk):
    document = get_object_or_404(Document, pk=pk)
    if document.created_by != request.user and not request.user.is_staff:
        return HttpResponseForbidden()
    document.delete()
    messages.success(request, "Document deleted.")
    return redirect("document_list")
