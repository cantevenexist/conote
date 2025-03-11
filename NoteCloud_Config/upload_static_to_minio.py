import os
import boto3
from botocore.exceptions import NoCredentialsError
import mimetypes

MINIO_ENDPOINT = os.getenv("AWS_S3_ENDPOINT_URL", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
MINIO_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
MINIO_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")
LOCAL_STATIC_DIR = "/static"

s3_client = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
)

local_static_path = "static"


def upload_to_s3(local_path, bucket, s3_path):
    try:
        content_type, _ = mimetypes.guess_type(local_path)
        if content_type is None:
            content_type = "application/octet-stream"
        print(f"Uploading {local_path} to s3://{bucket}/{s3_path} with Content-Type {content_type}")
        s3_client.upload_file(
            local_path,
            bucket,
            s3_path,
            ExtraArgs={'ContentType': content_type}
        )
    except FileNotFoundError:
        print(f"File {local_path} not found.")
    except NoCredentialsError:
        print("Credentials not available.")
    except Exception as e:
        print(f"Error uploading {local_path}: {e}")


def upload_directory(local_directory, bucket):
    print(f"Checking files in {local_directory}")
    for root, dirs, files in os.walk(local_directory):
        if not files:
            print(f"No files found in {local_directory}")
        for file in files:
            local_file_path = os.path.join(root, file)
            relative_path = os.path.relpath(local_file_path, local_directory)
            s3_file_path = f"static/{relative_path}"
            upload_to_s3(local_file_path, bucket, s3_file_path)


if __name__ == "__main__":
    upload_directory(local_static_path, MINIO_BUCKET_NAME)
