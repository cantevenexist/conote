from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NoteCloud_Config.settings')

app = Celery('NoteCloud_Config')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()


app.conf.beat_schedule = {
    'delete_old_trash_every_day': {
        'task': 'boards.tasks.delete_old_trash',
        'schedule': crontab(hour='0', minute='0'),
    },
}
