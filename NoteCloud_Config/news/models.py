from django.db import models

class News(models.Model):
    title = models.CharField(max_length=200)
    preview_content = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='news_images/', null=True, blank=True)  # Новое поле для изображения
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)