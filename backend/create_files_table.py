import psycopg2
from config import DATABASE_URL

def migrate():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id UUID PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            content_type VARCHAR(100) NOT NULL,
            file_size INT NOT NULL,
            data BYTEA NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Files table created successfully.")

if __name__ == "__main__":
    migrate()
