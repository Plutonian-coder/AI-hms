"""
Supabase S3 Storage Downloader
Downloads all uploaded files/photos from Supabase S3 bucket to local directory.
"""
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_S3_ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT")
SUPABASE_ACCESS_KEY_ID = os.getenv("SUPABASE_ACCESS_KEY_ID")
SUPABASE_SECRET_ACCESS_KEY = os.getenv("SUPABASE_SECRET_ACCESS_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "hms-uploads")

LOCAL_BACKUP_DIR = os.path.join(os.path.dirname(__file__), "supabase_storage_backup")

def main():
    if not all([SUPABASE_S3_ENDPOINT, SUPABASE_ACCESS_KEY_ID, SUPABASE_SECRET_ACCESS_KEY]):
        print("[WARNING] Supabase S3 credentials not fully configured in .env")
        return

    print("Connecting to Supabase S3 Storage...")
    s3_client = boto3.client(
        "s3",
        endpoint_url=SUPABASE_S3_ENDPOINT,
        aws_access_key_id=SUPABASE_ACCESS_KEY_ID,
        aws_secret_access_key=SUPABASE_SECRET_ACCESS_KEY,
        region_name="eu-west-1"
    )

    try:
        response = s3_client.list_objects_v2(Bucket=SUPABASE_BUCKET_NAME)
        objects = response.get("Contents", [])
        print(f"Found {len(objects)} files in bucket '{SUPABASE_BUCKET_NAME}'")

        if not objects:
            print("No files found to download.")
            return

        os.makedirs(LOCAL_BACKUP_DIR, exist_ok=True)

        for obj in objects:
            key = obj["Key"]
            local_file_path = os.path.join(LOCAL_BACKUP_DIR, key)
            os.makedirs(os.path.dirname(local_file_path), exist_ok=True)

            print(f"Downloading {key}...", end=" ")
            s3_client.download_file(SUPABASE_BUCKET_NAME, key, local_file_path)
            print("OK")

        print(f"\n[SUCCESS] All files downloaded to: {LOCAL_BACKUP_DIR}")

    except Exception as e:
        print(f"\n[INFO] Storage check: {e}")

if __name__ == "__main__":
    main()
