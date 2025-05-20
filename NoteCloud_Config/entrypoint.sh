#!/bin/sh

if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."

    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 0.1
    done

    echo "PostgreSQL started"
fi

# Применение миграций
python manage.py makemigrations
python manage.py migrate
python manage.py migrate django_celery_beat

# Очищение таблиц базы данных Postgre
#python manage.py flush --no-input

# Загрузка статики (js, css) в S3-хранилище
#python manage.py collectstatic
#python upload_static_to_minio.py

# Запуск telegram-бота (в фоновом режиме)
python telegram_bot.py &

# Запуск Celery worker и Celery beat в фоне
celery -A NoteCloud_Config worker --loglevel=info &
celery -A NoteCloud_Config beat --loglevel=info &

# Создание аккаунта суперпользователя
sh init_superadmin.sh

# Создание необходимых групп пользователей
python init_groups.py

# Запуск ASGI-сервера (ТРЕБУЕТСЯ ЗАГРУЗКА СТАТИКИ) или WSGI-сервера
daphne -b 0.0.0.0 -p 8000 NoteCloud_Config.asgi:application
#exec "$@"