import os
from django.db import models
from django.utils.text import slugify
from transliterate import translit
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()  # Получаем модель пользователя


class News(models.Model):
    title = models.CharField(max_length=255)
    preview_content = models.CharField(max_length=500, null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    image = models.ImageField(upload_to='news_images/', null=True, blank=True)
    slug = models.SlugField(max_length=300, unique=True, blank=True) # Допуск для slug больше на 45символов чем название для успешного его создания если сработало исключение
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            try:
                transliterated_title = translit(self.title, 'ru', reversed=True)
                self.slug = slugify(transliterated_title, allow_unicode=False)
            except Exception:
                timestamp = timezone.now().strftime("%H.%M.%S-%d.%m.%Y") 
                self.slug = slugify(f"{timestamp}", allow_unicode=False)
            
            if not self.slug:
                timestamp = timezone.now().strftime("%H.%M.%S-%d.%m.%Y")
                self.slug = slugify(f"{timestamp}", allow_unicode=False)

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


class Comment(models.Model):
    news = models.ForeignKey(News, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author.username} on {self.news.title}"