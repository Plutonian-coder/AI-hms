import logging
import boto3
from botocore.exceptions import ClientError
from config import (
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
    AWS_BUCKET_NAME
)

logger = logging.getLogger(__name__)

# Initialize the AWS S3 client
s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

def upload_file_to_s3(file_data: bytes, object_name: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload a file to the AWS S3 bucket.
    Returns the public URL of the uploaded file.
    """
    try:
        s3_client.put_object(
            Bucket=AWS_BUCKET_NAME,
            Key=object_name,
            Body=file_data,
            ContentType=content_type,
            ACL='public-read'
        )
        public_url = f"https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{object_name}"
        logger.info(f"Successfully uploaded {object_name} to AWS S3: {public_url}")
        return public_url
    except ClientError as e:
        logger.error(f"Failed to upload {object_name} to AWS S3: {e}")
        raise e

def create_bucket_if_not_exists():
    """Check if configured AWS S3 bucket exists."""
    try:
        s3_client.head_bucket(Bucket=AWS_BUCKET_NAME)
        logger.info(f"AWS S3 Bucket {AWS_BUCKET_NAME} exists and accessible.")
    except ClientError as e:
        logger.error(f"Error checking AWS S3 bucket {AWS_BUCKET_NAME}: {e}")
