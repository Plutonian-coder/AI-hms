"""
Yabatech Automated Hostel Management System — FastAPI Entry Point

Auth: Self-managed JWT (python-jose + passlib/bcrypt).
      No external auth service — everything lives in Supabase Postgres.
"""
import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import CORS_ORIGINS
from routers import auth, allocation, admin
from tasks import auto_revoke_expired_allocations

app = FastAPI(
    title="Yabatech Hostel Management System",
    description="Automated hostel allocation with Block hierarchy, 7-day revocation, and room accountability.",
    version="2.0.0",
)


@app.on_event("startup")
async def startup_event():
    """Start background tasks on server startup."""
    # 7-day payment auto-revocation runs every hour (Yabatech institutional policy)
    asyncio.create_task(auto_revoke_expired_allocations())


# CORS — allow configured frontend origins only
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# UptimeRobot ping — pure Python, zero DB, called every 5 min on free Render tier
@app.get("/health")
def health_ping():
    return {"status": "alive"}


# Richer health check for internal monitoring
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Yabatech Hostel Management System", "version": "2.0.0"}


# Mount routers (before static files so API routes are matched first)
app.include_router(auth.router)
app.include_router(allocation.router)
app.include_router(admin.router)

# Serve frontend static files LAST (catch-all at "/")
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
