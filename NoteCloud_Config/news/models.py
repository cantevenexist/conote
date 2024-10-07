import os
from django.db import models

class News(models.Model):
    title = models.CharField(max_length=200)
    preview_content = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='news_images/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        # Проверяем, существует ли объект в базе данных
        if self.pk:
            try:
                old_image = News.objects.get(pk=self.pk).image
            except News.DoesNotExist:
                old_image = None

            # Если старое изображение существует и отличается от нового, удаляем его
            if old_image and old_image != self.image:
                if os.path.isfile(old_image.path):
                    os.remove(old_image.path)

        super().save(*args, **kwargs)  # Вызываем метод save родительского класса