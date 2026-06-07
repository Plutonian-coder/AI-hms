"""
DEPRECATED — This file has been moved to scripts/create_admin.py

Usage:
  python scripts/create_admin.py
  docker compose exec backend python scripts/create_admin.py
"""
import sys
print("This script has been moved to scripts/create_admin.py", file=sys.stderr)
print("Run: python scripts/create_admin.py", file=sys.stderr)

# Forward to new location
from scripts.create_admin import create_admin
create_admin()
