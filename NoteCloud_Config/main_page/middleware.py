from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from django.conf import settings


class AllowedIPMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        allowed_ips = getattr(settings, 'ALLOWED_ADMIN_IPS', [])
        if request.path.startswith('/admin') and request.META['REMOTE_ADDR'] not in allowed_ips:
            # return redirect('/')
            return render(request, '404.html', status=404)

        return response
