from django.shortcuts import render, redirect
from rest_framework.views import APIView
from rest_framework.response import Response


class IndexView(APIView):
    def get(self, request):
        return render(request, 'news/index.html')
