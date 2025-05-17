from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
from asgiref.sync import sync_to_async


@sync_to_async
def render_sync(request, template_name, context=None, **kwargs):
    return render(request, template_name, context or {}, **kwargs)


class IndexView(View):
    async def get(self, request, *args, **kwargs):
        context = {}

        return await render_sync(request, 'main_page/index.html', context)

    async def post(self, request, *args, **kwargs):
        data = request.POST.get('data')

        return JsonResponse({'success': True, 'data': data})


async def custom_404(request, exception):
    return await render_sync(request, '404.html', context=None, status=404)
