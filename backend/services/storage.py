import logging
import boto3
from botocore.exceptions import ClientError
from config import (
    SUPABASE_S3_ENDPOINT,
    SUPABASE_ACCESS_KEY_ID,
    SUPABASE_SECRET_ACCESS_KEY,
    SUPABASE_BUCKET_NAME,
    SUPABASE_PROJECT_URL
)

logger = logging.getLogger(__name__)

# Initialize the S3 client
s3_client = boto3.client(
    "s3",
    endpoint_url=SUPABASE_S3_ENDPOINT,
    aws_access_key_id=SUPABASE_ACCESS_KEY_ID,
    aws_secret_access_key=SUPABASE_SECRET_ACCESS_KEY,
    region_name="eu-west-1" # Region based on the pooler url aws-1-eu-west-1
)

def upload_file_to_s3(file_data: bytes, object_name: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload a file to the Supabase S3 bucket.
    Returns the public URL of the uploaded file.
    """
    try:
        s3_client.put_object(
            Bucket=SUPABASE_BUCKET_NAME,
            Key=object_name,
            Body=file_data,
            ContentType=content_type,
        )
        # Assuming the bucket is public, we can construct the Supabase public URL
        # Supabase public storage format: https://[project_ref].supabase.co/storage/v1/object/public/[bucket]/[key]
        public_url = f"{SUPABASE_PROJECT_URL}/storage/v1/object/public/{SUPABASE_BUCKET_NAME}/{object_name}"
        logger.info(f"Successfully uploaded {object_name} to {SUPABASE_BUCKET_NAME}")
        return public_url
    except ClientError as e:
        logger.error(f"Failed to upload {object_name} to S3: {e}")
        raise e

def create_bucket_if_not_exists():
    """Create the configured bucket if it doesn't already exist."""
    try:
        s3_client.head_bucket(Bucket=SUPABASE_BUCKET_NAME)
        logger.info(f"Bucket {SUPABASE_BUCKET_NAME} already exists.")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            logger.info(f"Bucket {SUPABASE_BUCKET_NAME} does not exist. Creating...")
            # Wait, Supabase S3 API doesn't support CreateBucket via S3.
            # But we can try just in case. If it fails, the user must create it from the dashboard.
            try:
                s3_client.create_bucket(Bucket=SUPABASE_BUCKET_NAME)
                logger.info(f"Created bucket {SUPABASE_BUCKET_NAME}.")
            except Exception as create_e:
                logger.error(f"Failed to create bucket: {create_e}. Please create the '{SUPABASE_BUCKET_NAME}' bucket (set to Public) in your Supabase Dashboard.")
        else:
            logger.error(f"Error checking bucket {SUPABASE_BUCKET_NAME}: {e}")
