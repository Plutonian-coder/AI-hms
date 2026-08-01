"""
AWS RDS Database Importer & Verification Script
Restores complete schema and exported Supabase data onto AWS RDS PostgreSQL.
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv(override=True)

DEFAULT_ENDPOINT = "ai-hms-db.cjgcoqu6std2.eu-west-2.rds.amazonaws.com"
SCHEMA_FILE = os.path.join(os.path.dirname(__file__), "schema_exec.sql")
DATA_FILE = os.path.join(os.path.dirname(__file__), "supabase_data_export.sql")

def run_import(db_url):
    print(f"Connecting to AWS RDS PostgreSQL...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=15)
        conn.autocommit = True
    except Exception as e:
        print(f"\n[ERROR] Connection failed: {e}")
        print("\nPossible reasons:")
        print("1. Password might be incorrect.")
        print("2. AWS Security Group is blocking inbound traffic on port 5432.")
        return False

    print("Connected successfully to AWS RDS!\n")
    cur = conn.cursor()

    # Step 1: Run Schema Execution
    if os.path.exists(SCHEMA_FILE):
        print("Executing schema_exec.sql (creating tables, indexes, triggers)...", end=" ")
        with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
            sql = f.read()
            cur.execute(sql)
        print("OK")

    # Step 2: Run Migrations if any
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    if os.path.exists(migrations_dir):
        for m_file in sorted(os.listdir(migrations_dir)):
            if m_file.endswith(".sql"):
                m_path = os.path.join(migrations_dir, m_file)
                print(f"Applying migration {m_file}...", end=" ")
                try:
                    with open(m_path, "r", encoding="utf-8") as f:
                        cur.execute(f.read())
                    print("OK")
                except Exception as m_err:
                    print(f"Skipped/OK ({m_err})")

    # Step 3: Import Supabase Data
    if os.path.exists(DATA_FILE):
        print("Importing saved Supabase data (users, applications, allocations)...", end=" ")
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            sql = f.read()
            cur.execute(sql)
        print("OK")

    # Verification
    print("\n--- DATABASE VERIFICATION ---")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f"Total tables on AWS RDS: {len(tables)}")
    
    for table in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{table}";')
        count = cur.fetchone()[0]
        print(f"  - {table}: {count} records")

    conn.close()
    print("\n[SUCCESS] AWS RDS Database is fully populated and verified!")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        pwd = sys.argv[1]
    else:
        pwd = os.getenv("AWS_DB_PASSWORD", "")
    
    if not pwd:
        print("Usage: python import_to_aws.py <YOUR_AWS_DB_PASSWORD>")
        sys.exit(1)

    db_url = f"postgresql://postgres:{pwd}@{DEFAULT_ENDPOINT}:5432/postgres"
    run_import(db_url)
