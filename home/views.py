from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET


@require_GET
def index(request):
    if request.user.is_authenticated:
        return redirect("document_list")
    return render(request, "home/index.html")
