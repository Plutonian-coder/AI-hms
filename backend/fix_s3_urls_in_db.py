"""
Fix image URLs in AWS RDS database to point to AWS S3 bucket.
"""
import psycopg2
from config import DATABASE_URL, AWS_BUCKET_NAME, AWS_REGION

OLD_PREFIX = "https://jekpgzxzknojijfbuhbu.supabase.co/storage/v1/object/public/hms-uploads/"
NEW_PREFIX = f"https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(f"""
        UPDATE users 
        SET passport_photo_url = REPLACE(passport_photo_url, '{OLD_PREFIX}', '{NEW_PREFIX}')
        WHERE passport_photo_url LIKE '%supabase.co%';
    """)
    print("Updated passport photo URLs in users table.")
    conn.close()

if __name__ == "__main__":
    main()
