"""
HMS — AI-Driven Hostel Management System — FastAPI Entry Point

Auth: Self-managed JWT (python-jose + passlib/bcrypt).
"""
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import CORS_ORIGINS
from routers import auth, allocation, admin, payment, application, register_import, quiz, report

app = FastAPI(
    title="HMS — Hostel Management System",
    description="AI-driven hostel allocation with compatibility matching, multi-component fees, and audit trail.",
    version="3.0.0",
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
    traceback.print_exc()
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

# Serve frontend static files LAST
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
