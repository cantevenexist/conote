from django.shortcuts import render
from django.views.generic.base import TemplateView
from django.http import JsonResponse


class IndexView(TemplateView):
    template_name = 'main_page/index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        return context

    def get(self, request, *args, **kwargs):
        if request.headers.get('HX-Request'):
            return render(request, 'main_page/partials/index.html', self.get_context_data())

        return super().get(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        data = request.POST.get('data')

        return JsonResponse({'success': True, 'data': data})


def custom_404(request, exception):
    return render(request, '404.html', status=404)
