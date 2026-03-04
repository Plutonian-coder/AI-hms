"""
Create a test admin account.
Usage: python create_admin.py
"""
import sys
sys.path.insert(0, '.')

from dotenv import load_dotenv
load_dotenv()

from config import supabase
from database import get_cursor, get_connection

ADMIN_IDENTIFIER = "ADMIN001"
ADMIN_PASSWORD = "admin123"
ADMIN_SURNAME = "System"
ADMIN_FIRST_NAME = "Admin"
ADMIN_GENDER = "male"

email = f"{ADMIN_IDENTIFIER.lower()}@yabatech.edu.ng"

print(f"Creating admin: {ADMIN_IDENTIFIER} / {ADMIN_PASSWORD}")

# 1. Register in Supabase Auth
try:
    auth_response = supabase.auth.sign_up({
        "email": email,
        "password": ADMIN_PASSWORD,
        "options": {"data": {"identifier": ADMIN_IDENTIFIER, "role": "admin"}}
    })
    print("✓ Supabase Auth sign-up successful")
except Exception as e:
    # Maybe already exists in Auth - try sign in
    try:
        auth_response = supabase.auth.sign_in_with_password({"email": email, "password": ADMIN_PASSWORD})
        print("✓ Admin already in Supabase Auth, signed in")
    except Exception as e2:
        print(f"✗ Supabase Auth failed: {e2}")
        sys.exit(1)

# 2. Insert into local DB with role = admin
with get_cursor() as cur:
    cur.execute("SELECT id FROM users WHERE identifier = %s", (ADMIN_IDENTIFIER,))
    row = cur.fetchone()
    if row:
        # Update role to admin if already exists
        cur.execute("UPDATE users SET role = 'admin' WHERE identifier = %s", (ADMIN_IDENTIFIER,))
        print(f"✓ Updated existing user to admin (id={row[0]})")
    else:
        cur.execute(
            """INSERT INTO users (identifier, surname, first_name, gender, password_hash, role)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (ADMIN_IDENTIFIER, ADMIN_SURNAME, ADMIN_FIRST_NAME, ADMIN_GENDER, "supabase_auth", "admin"),
        )
        user_id = cur.fetchone()[0]
        print(f"✓ Created admin in local DB (id={user_id})")

print(f"\n{'='*40}")
print(f"Admin Login Credentials:")
print(f"  Matric/ID:  {ADMIN_IDENTIFIER}")
print(f"  Password:   {ADMIN_PASSWORD}")
print(f"{'='*40}")
