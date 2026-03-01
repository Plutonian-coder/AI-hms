# HMS — Hostel Management System

An automated hostel allocation platform built for Yabatech. Students upload payment receipts, and the system uses AI-powered OCR to validate them, then atomically assigns bed spaces based on hostel preferences — no manual admin intervention required.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Allocation Algorithm](#allocation-algorithm)
- [Deployment](#deployment)

## Features

### Student Portal
- **3-preference hostel application** — rank hostels by preference; the system assigns the first available bed
- **AI receipt validation** — Gemini 2.5 Flash Vision verifies Remita payment receipts for authenticity and extracts the 12-digit RRR
- **Real-time allocation pipeline** — 6-step SSE stream shows live progress (upload → AI check → payment verify → allocate)
- **Dashboard** — view profile, allocation status, roommates, session info
- **Public allocation lookup** — check allocation by matric number without logging in

### Admin Panel
- **Session management** — create academic sessions, open/close the allocation portal
- **Hostel & bed space management** — create hostels with gender restrictions, bulk-generate rooms and beds
- **Dashboard statistics** — total students, hostels, beds, occupancy rates, active allocations
- **Student directory** — browse all registered students and their allocation status

### System
- **Atomic allocation** — PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` prevents double-bookings under concurrent load
- **Fraud prevention** — SHA-256 receipt hashing blocks duplicate uploads; AI rejects fabricated receipts
- **Supabase Auth** — token-based authentication with role-based access control (student/admin)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS 4, React Router 7 |
| Backend | FastAPI, Gunicorn + Uvicorn |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email/password) |
| AI/OCR | Google Gemini 2.5 Flash Vision |
| Payment | Mock Remita verification table |

## Architecture

```
hostelms/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py             # Environment config + Supabase client
│   ├── database.py           # PostgreSQL connection pool
│   ├── dependencies.py       # Auth dependency injection
│   ├── models.py             # Pydantic request/response schemas
│   ├── schema_exec.sql       # Database DDL + allocate_bed() function
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py           # Register, login
│   │   ├── allocation.py     # Student dashboard, apply, check
│   │   └── admin.py          # Sessions, hostels, rooms, stats
│   └── services/
│       ├── auth.py           # Supabase Auth wrapper
│       └── ocr.py            # Gemini Vision receipt processing
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json           # SPA rewrite rules
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx           # Routing, layouts, auth guards
│   │   ├── index.css         # TailwindCSS 4 theme
│   │   ├── api/client.js     # Axios instance with auth interceptors
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── AdminSidebar.jsx
│   │   └── pages/
│   │       ├── LandingPage.jsx
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Apply.jsx
│   │       ├── MyAllocation.jsx
│   │       └── Admin/
│   │           ├── AdminDashboard.jsx
│   │           ├── AdminHostels.jsx
│   │           ├── AdminBedSpaces.jsx
│   │           ├── AdminSessions.jsx
│   │           └── AdminStudents.jsx
├── render.yaml               # Render deployment config
└── .gitignore
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database (or Supabase project)
- Google Gemini API key

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Initialize database
# Run schema_exec.sql against your PostgreSQL instance

# Start server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install

# Start dev server
npm run dev
```

The frontend reads `VITE_API_URL` for the backend base URL. Defaults to `http://localhost:8000/api/v1` in development.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_HOST` | PostgreSQL host | `aws-0-eu-west-1.pooler.supabase.com` |
| `DATABASE_PORT` | PostgreSQL port | `6543` |
| `DATABASE_NAME` | Database name | `postgres` |
| `DATABASE_USER` | Database user | `postgres.your-project-ref` |
| `DATABASE_PASSWORD` | Database password | — |
| `JWT_SECRET` | Token signing secret | — |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `JWT_EXPIRY_MINUTES` | Token TTL | `1440` |
| `UPLOAD_DIR` | Receipt upload path | `./uploads` |
| `GEMINI_API_KEY` | Google Gemini API key | — |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

## Database Schema

Six core tables plus one PostgreSQL function:

| Table | Purpose |
|-------|---------|
| `users` | Students and admins (linked to Supabase Auth) |
| `academic_sessions` | Session management with portal toggle |
| `hostels` | Hostel definitions with gender restrictions |
| `rooms` | Rooms within hostels |
| `beds` | Individual bed spaces (vacant/occupied/maintenance) |
| `allocations` | Student-to-bed assignments per session |
| `allocation_requests` | Audit log of all application attempts |
| `mock_remita_payments` | Simulated payment verification records |

Key constraints:
- `UNIQUE(student_id, session_id)` on allocations — one bed per student per session
- `UNIQUE(bed_id, session_id)` on allocations — one student per bed per session
- `allocate_bed()` function uses `FOR UPDATE SKIP LOCKED` for concurrent safety

## API Reference

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/v1/allocation/check?matric=` | Lookup allocation by matric (case-insensitive) |

### Auth (`/api/v1/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Create account |
| `POST` | `/login` | Sign in, receive token |

### Student (`/api/v1/allocation`) — requires `Bearer` token

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard` | Full dashboard data |
| `PATCH` | `/profile` | Update department, level, email, phone |
| `GET` | `/hostels` | Available hostels (gender-filtered) |
| `GET` | `/my-allocation` | Current allocation + roommates |
| `POST` | `/apply` | Submit application (SSE stream response) |

### Admin (`/api/v1/admin`) — requires admin `Bearer` token

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create academic session |
| `GET` | `/sessions` | List all sessions |
| `PATCH` | `/session/toggle` | Open/close allocation portal |
| `GET` | `/session/status` | Active session info |
| `POST` | `/hostels` | Create hostel |
| `GET` | `/hostels` | List hostels with stats |
| `POST` | `/hostels/{id}/rooms` | Bulk-create rooms and beds |
| `GET` | `/stats` | Dashboard statistics |
| `GET` | `/students` | Student directory |

## Allocation Algorithm

The allocation runs inside a PostgreSQL function (`allocate_bed`) for atomicity:

1. **Validate** — reject if student already allocated this session
2. **Iterate choices** — try hostel preference 1, then 2, then 3
3. **Find bed** — `SELECT` first vacant bed in an active room, ordered by room/bed number
4. **Lock** — `FOR UPDATE SKIP LOCKED` acquires a row lock (competing requests skip locked rows)
5. **Assign** — mark bed as `occupied`, insert allocation record
6. **Fail safely** — if all 3 choices are full, raise exception (no partial state)

This is a **First Come, First Served (FCFS)** system with preference ordering.

## Deployment

### Frontend → Vercel

1. Import the repository on Vercel
2. Set **Root Directory** to `frontend`
3. Framework preset: **Vite** (auto-detected)
4. Add environment variable:
   - `VITE_API_URL` = `https://your-backend.onrender.com/api/v1`
5. Deploy

### Backend → Render

1. Import the repository on Render
2. Render reads `render.yaml` automatically
3. Add all environment variables from `.env.example` in the dashboard
4. Deploy

Alternatively, configure manually:
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

## License

MIT
