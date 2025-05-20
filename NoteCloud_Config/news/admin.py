from django.contrib import admin
from .models import Comment, News


admin.site.register(Comment)
admin.site.register(News)
