"""
Upload Backed Up Files to AWS S3
Uploads all files from backend/supabase_storage_backup into AWS S3 bucket.
"""
import os
import mimetypes
from services.storage import upload_file_to_s3

BACKUP_DIR = os.path.join(os.path.dirname(__file__), "supabase_storage_backup")

def main():
    if not os.path.exists(BACKUP_DIR):
        print(f"Backup directory not found: {BACKUP_DIR}")
        return

    print("Uploading backed-up files to AWS S3...\n")
    uploaded_count = 0

    for root, dirs, files in os.walk(BACKUP_DIR):
        for file in files:
            file_path = os.path.join(root, file)
            # Relative key path (e.g. photos/27_03c66b2c.jpg)
            rel_path = os.path.relpath(file_path, BACKUP_DIR).replace("\\", "/")
            
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = "application/octet-stream"

            print(f"Uploading '{rel_path}'...", end=" ")
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                url = upload_file_to_s3(data, rel_path, content_type)
                print(f"OK ({url})")
                uploaded_count += 1
            except Exception as e:
                print(f"FAILED: {e}")

    print(f"\n[SUCCESS] Uploaded {uploaded_count} files to AWS S3 bucket!")

if __name__ == "__main__":
    main()
