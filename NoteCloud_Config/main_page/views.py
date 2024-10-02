from django.shortcuts import render, redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import News
from .serializers import NewsTitlesSerializer, NewsContentSerializer
from django.core.paginator import Paginator


class IndexView(APIView):
    def get(self, request):
        return render(request, 'main_page/index.html')


class NewsView(APIView):
    def get(self, request):
        api_data = NewsTitlesView().get(request)
        paginator = Paginator(api_data.data, per_page=5)
        page = request.GET.get('page')
        page_object = paginator.get_page(page)
        return render(request, 'main_page/news.html', {'news': page_object})


class NewsTitlesView(APIView):
    def get(self, request):
        news = News.objects.only('id', 'title', 'date').order_by('-date')
        serializer = NewsTitlesSerializer(news, many=True)
        return Response(serializer.data)


class NewsContentView(APIView):
    def get(self, request, news_id):
        try:
            news = News.objects.get(id=news_id)
        except News.DoesNotExist:
            return Response({'error': 'Item not found'}, status=404)
        serializer = NewsContentSerializer(news)
        return Response(serializer.data)


class ContentView(APIView):
    def get(self, request, news_id):
        api_data = NewsContentView().get(request, news_id)
        return render(request, 'main_page/news_content.html', {'news': api_data.data})


def custom_404(request, exception):
    return render(request, '404.html', status=404)
