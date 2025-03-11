#!/bin/sh

if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."

    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 0.1
    done

    echo "PostgreSQL started"
fi

#python manage.py flush --no-input
python manage.py makemigrations
python manage.py migrate
#python upload_static_to_minio.py
#python telegram_bot.py &

#daphne -b 0.0.0.0 -p 8000 NoteCloud_Config.asgi:application
exec "$@"