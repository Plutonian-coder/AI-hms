"""
HMS — AI-Driven Hostel Management System — FastAPI Entry Point

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
from routers import auth, allocation, admin, payment, application, register_import, quiz, report

# ── Initialize structured logging before anything else ───────────────────────
setup_logging()
logger = logging.getLogger(__name__)


# ── Lifespan: startup validation + graceful shutdown (Factor IX) ─────────────
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

    yield

    # Shutdown: close all database connections
    logger.info("Shutting down — closing database connections")
    close_pool()
    logger.info("Shutdown complete")


app = FastAPI(
    title="HMS — Hostel Management System",
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
    return {"status": "ok", "service": "HMS — Hostel Management System", "version": "3.0.0"}


# Mount routers
app.include_router(auth.router)
app.include_router(allocation.router)
app.include_router(admin.router)
app.include_router(payment.router)
app.include_router(application.router)
app.include_router(register_import.router)
app.include_router(quiz.router)
app.include_router(report.router)
