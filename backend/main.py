"""
FUOYE — Hostel Management Portal — FastAPI Entry Point

12-Factor Compliant:
  - Factor VII:  Port binding via $PORT env var
  - Factor IX:   Lifespan manager for startup validation + graceful shutdown
  - Factor XI:   Structured logging to stdout (no file handlers)

Auth: Self-managed JWT (python-jose + passlib/bcrypt).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from logging_config import setup_logging
from config import CORS_ORIGINS
from database import get_pool, close_pool
from routers import auth, allocation, admin, eligibility, application, payment, register_import, quiz, report
import tasks
import asyncio

# ── Initialize structured logging before anything else ───────────────────────
setup_logging()
logger = logging.getLogger(__name__)


# ── Lifespan: startup validation + graceful shutdown (Factor IX) ─────────────
async def run_background_tasks():
    while True:
        try:
            tasks.revoke_expired_allocations()
        except Exception as e:
            logger.error(f"Background task error: {e}")
        await asyncio.sleep(3600)  # Run every 1 hour

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: validate database connectivity
    try:
        pool = get_pool()
        conn = pool.getconn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        pool.putconn(conn)
        logger.info("Startup health check passed — database is reachable")
    except Exception as e:
        logger.critical("Startup health check FAILED — database unreachable: %s", e)
        raise

    # Start background tasks
    bg_task = asyncio.create_task(run_background_tasks())

    yield

    # Shutdown: close all database connections
    logger.info("Shutting down — canceling background tasks and closing database connections")
    bg_task.cancel()
    close_pool()
    logger.info("Shutdown complete")


app = FastAPI(
    title="FUOYE — Hostel Management Portal",
    description="AI-driven hostel allocation with compatibility matching, multi-component fees, and audit trail.",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in CORS_ORIGINS:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
        headers=headers,
    )


@app.get("/health")
def health_ping():
    return {"status": "alive"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "FUOYE — Hostel Management Portal", "version": "3.0.0"}


# Mount routers
app.include_router(auth.router)
app.include_router(allocation.router)
app.include_router(admin.router)
app.include_router(payment.router)
app.include_router(application.router)
app.include_router(register_import.router)
app.include_router(quiz.router)
app.include_router(report.router)
