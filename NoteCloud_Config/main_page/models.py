from django.db import models


class News(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=300)
    content = models.CharField(max_length=1500)
    date = models.DateTimeField(auto_now_add=True)
