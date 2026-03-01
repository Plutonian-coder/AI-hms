"""
Yabatech Automated Hostel Management System — FastAPI Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth, allocation, admin
import os

app = FastAPI(
    title="Yabatech Hostel Management System",
    description="100% automated hostel allocation — no admin dashboard required.",
    version="1.0.0",
)

# CORS — allow frontend (dev & production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Yabatech Hostel Management System"}


# Mount routers (before static files)
app.include_router(auth.router)
app.include_router(allocation.router)
app.include_router(admin.router)

# Serve frontend static files LAST (catch-all at "/")
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
