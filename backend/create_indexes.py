import psycopg2
from config import DATABASE_URL

def migrate():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    queries = [
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_identifier ON users(identifier);",
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_session_status ON allocations(session_id, status);"
    ]
    
    for query in queries:
        try:
            cur.execute(query)
            print(f"Executed: {query}")
        except Exception as e:
            print(f"Error executing {query}: {e}")
            
    cur.close()
    conn.close()
    print("Indexes created successfully.")

if __name__ == "__main__":
    migrate()
