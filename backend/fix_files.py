import os
from database import get_connection

with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT id, medical_doc_path FROM hostel_applications WHERE medical_doc_path IS NOT NULL")
    for row in cur.fetchall():
        path = row[1]
        if not os.path.exists(path):
            print(f'Missing: {path}')
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write('dummy file content')
            print(f'Created dummy for {path}')
