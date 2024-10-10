from django.db import models
from django.utils.text import slugify
from transliterate import translit
import os

class News(models.Model):
    title = models.CharField(max_length=200)
    preview_content = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='news_images/', null=True, blank=True)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            # Преобразуем заголовок в латиницу
            transliterated_title = translit(self.title, 'ru', reversed=True)  # Транслитерация
            self.slug = slugify(transliterated_title, allow_unicode=False)  # Генерация slug
            
            # Проверяем уникальность slug
            original_slug = self.slug
            counter = 1
            while News.objects.filter(slug=self.slug).exists():
                self.slug = f"{original_slug}-{counter}"
                counter += 1

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
