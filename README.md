# NoteCloud

Команда для запуска докера:
docker-compose -f docker-compose.yml up --build

#  MINIO

Команды для настройки хранилища s3 (выполняются в контейнере minio):
`mc alias set myaistor http://127.0.0.1:9000 root rootroot`
и
`mc admin accesskey create myaistor`
