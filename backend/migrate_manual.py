from database import get_connection

try:
    with get_connection() as conn:
        with conn.cursor() as cur:
            with open("migrations/add_fee_deadlines_disability.sql", "r") as f:
                sql = f.read()
            cur.execute(sql)
        conn.commit()
    print("Migration applied successfully")
except Exception as e:
    print(f"Error applying migration: {e}")
