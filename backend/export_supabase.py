"""
Supabase Data Exporter
Connects to Supabase PostgreSQL database and exports all tables into clean SQL INSERT statements.
"""
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not set in .env file.")
    sys.exit(1)

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "supabase_data_export.sql")

def format_value(val):
    if val is None:
        return "NULL"
    elif isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    elif isinstance(val, (int, float)):
        return str(val)
    elif isinstance(val, list):
        items = [f"'{str(x).replace(chr(39), '''''')}'" for x in val]
        return f"ARRAY[{', '.join(items)}]"
    elif isinstance(val, dict):
        import json
        escaped = json.dumps(val).replace("'", "''")
        return f"'{escaped}'"
    else:
        # String / Datetime / UUID / text
        escaped = str(val).replace("'", "''")
        return f"'{escaped}'"

def main():
    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
    except Exception as e:
        print(f"\n[ERROR] Could not connect to Supabase: {e}")
        print("\n[ACTION REQUIRED] Please log into your Supabase Dashboard (https://supabase.com/dashboard) and click 'Restore Project'. Wait 1-2 minutes for it to come back online, then run this again!")
        return False

    cur = conn.cursor()
    
    # Get all public tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f"Found {len(tables)} tables: {', '.join(tables)}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("-- Supabase Data Export\n")
        f.write("SET session_replication_role = 'replica'; -- Disable triggers/FK checks during import\n\n")

        for table in tables:
            print(f"Exporting table: {table}...", end=" ")
            dict_cur = conn.cursor(cursor_factory=RealDictCursor)
            dict_cur.execute(f'SELECT * FROM "{table}";')
            rows = dict_cur.fetchall()
            print(f"({len(rows)} rows)")

            if not rows:
                continue

            f.write(f"-- Data for {table}\n")
            cols = list(rows[0].keys())
            cols_str = ", ".join([f'"{c}"' for c in cols])

            for row in rows:
                vals = [format_value(row[c]) for c in cols]
                vals_str = ", ".join(vals)
                f.write(f'INSERT INTO "{table}" ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;\n')

            f.write("\n")

        f.write("SET session_replication_role = 'origin'; -- Re-enable triggers/FK checks\n")

    conn.close()
    print(f"\n[SUCCESS] Data exported to: {OUTPUT_FILE}")
    return True

if __name__ == "__main__":
    main()
