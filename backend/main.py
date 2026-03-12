"""
Yabatech Automated Hostel Management System — FastAPI Entry Point

Auth: Self-managed JWT (python-jose + passlib/bcrypt).
      No external auth service — everything lives in Supabase Postgres.
"""
import asyncio
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import CORS_ORIGINS
from routers import auth, allocation, admin, eligibility, payment, checkout
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


# Global exception handler — ensures CORS headers are always present on errors
# Without this, unhandled 500s bypass CORSMiddleware and browsers report CORS errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
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
app.include_router(eligibility.router)
app.include_router(payment.router)
app.include_router(checkout.router)

# Serve frontend static files LAST (catch-all at "/")
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
