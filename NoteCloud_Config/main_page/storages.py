from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings
from urllib.parse import urlparse


class MinioStorageStatic(S3Boto3Storage):
    def __init__(self, *args, **kwargs):
        super(MinioStorageStatic, self).__init__(*args, **kwargs)

    def url(self, name):
        url = super().url(name)
        parsed_url = urlparse(url)
        return parsed_url._replace(scheme='http').geturl()
