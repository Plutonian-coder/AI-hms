# AI-Driven Hostel Management System

> Design and Implementation of an AI-Driven Hostel Management System with Compatibility-Based Roommate Matching and Secure Payment Integration

**Institution:** Federal University Oye-Ekiti, Ekiti State, Nigeria  
**Author:** Zannu Rita Senami (FPT/CSC/25/0130902)  
**Department:** Computer Science, Faculty of Science  
**Supervisor:** Mr Olukumoro, S.O  
**Session:** 2025/2026 Academic Session

---

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://ai-hms-nine.vercel.app |
| Backend API | https://ai-hms-nine.onrender.com/api/v1 |
| API Docs | https://ai-hms-nine.onrender.com/docs |
| GitHub | https://github.com/Plutonian-coder/AI-hms |

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [System Objectives](#system-objectives)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Allocation Algorithm](#allocation-algorithm)
- [Payment Flow](#payment-flow)
- [Audit Trail](#audit-trail)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Overview

This system is a full-stack web platform that replaces the manual hostel allocation process in Nigerian federal universities with an automated, AI-assisted, and auditable digital workflow. It covers the entire student accommodation lifecycle — from institutional identity verification at registration through compatibility-based bed assignment — while providing administrators with session management, infrastructure management, financial reporting, a natural language query interface, and an immutable audit trail.

The system is designed in **University (BSc) mode** for Federal University Oye-Ekiti, supporting 100L–500L students across three study types: Full-time, Part-time, and Sandwich. The architecture is institution-agnostic and configurable for Polytechnics (ND/HND levels) and Colleges of Education (NCE levels).

---

## Problem Statement

The existing manual hostel management system at Nigerian federal universities exhibits four critical failures:

1. **No real-time identity verification** — students self-declare details with no automated check against enrolled student records, enabling unauthorised access and identity errors.
2. **Opaque, undifferentiated fee charging** — hostel fees are communicated as a single total with no itemisation of components (accommodation, electricity levy, caution deposit, etc.), causing financial disputes.
3. **Random bed assignment** — students are allocated beds with no consideration of lifestyle compatibility, leading to documented roommate conflicts that negatively affect academic performance.
4. **No administrative audit trail** — allocation overrides, portal changes, and fee adjustments are unrecorded, leaving an institutional accountability gap.

---

## System Objectives

1. Implement session register verification — admins import a CSV of enrolled students; every registration attempt is validated against it in real time.
2. Design a multi-component fee builder — admins define named fee components (Accommodation, Electricity Levy, Water Levy, Caution Deposit, etc.) per study type and per session.
3. Integrate Paystack as the sole payment gateway, generating a session-scoped HMS receipt reference (`HMS/YYYY/XXXXX`) upon confirmed payment.
4. Implement an AI-powered compatibility matching algorithm using **weighted cosine similarity** on 8-dimensional student lifestyle vectors for bed assignment.
5. Build a natural language query interface on the admin dashboard — plain English questions are converted to validated, read-only SQL queries by the Google Gemini API.
6. Implement an **immutable, append-only audit trail** recording 22 categories of system events, enforced at the database permission level (INSERT-only on `audit_logs`).
7. Build a structured **report builder** with a filter and column catalogue, live preview, and CSV export covering all system data domains.
8. Evaluate the system through functional testing covering normal operation and edge cases: concurrent allocation, closed portal access, study-type fee mismatch, and invalid CSV formats.

---

## Features

### Student Portal

| Feature | Detail |
|---------|--------|
| **Session register verification** | Matric number validated against the imported register CSV at registration. Account fields (name, gender, department, level, study type) are auto-populated from the institutional record. |
| **6-step sequential gate flow** | Register → Hostel Application → Payment → Payment Callback → Compatibility Quiz → AI Allocation. Each step is backend-enforced; skipping or re-entering a step returns HTTP 403. |
| **Hostel application form** | Student selects 3 ranked hostel preferences from gender-appropriate hostels. Itemised fee summary shown per study type before proceeding to payment. |
| **Paystack payment** | Student is redirected to a Paystack-hosted checkout page. Payment is verified server-side via webhook + callback. |
| **SSE streaming callback** | Real-time Server-Sent Events stream payment verification steps (initialise → authorise → verify → confirm) to the browser during the callback. |
| **HMS receipt reference** | Auto-generated unique reference in format `HMS/YYYY/XXXXX` replaces paper receipts as official proof of payment. |
| **Compatibility questionnaire** | 8-question lifestyle quiz (sleep time, wake time, study noise, cleanliness, visitor frequency, night device use, social preference, noise tolerance). Answers encoded as a normalised numeric vector. |
| **AI bed allocation** | Weighted cosine similarity computed between the student vector and existing occupants of all candidate rooms. Student assigned to highest-scoring available bed. |
| **Allocation page** | Shows assigned hostel, block, room, bed number, all roommates with compatibility percentages, and a Gemini-generated natural language match summary. |
| **Dashboard** | 6-step progress stepper, profile card (matric badge, department, level, study type), and allocation status panel. |
| **Profile update** | Students can update email, phone, department, and level after registration. |
| **Public allocation lookup** | Check any allocation by matric number without logging in. |

### Admin Portal

| Feature | Detail |
|---------|--------|
| **Session management** | Create academic sessions, set active session, toggle allocation portal open/closed per phase. |
| **Session register import** | Upload a CSV file of enrolled students. The system validates column format and loads records into `session_register`. |
| **Multi-component fee builder** | Define named fee components with per-study-type amounts per session. Total fee is computed dynamically from active components. |
| **Hostel infrastructure** | Create hostels (name, gender restriction, total capacity). Create blocks within hostels. Bulk-generate rooms and beds within blocks. |
| **Student directory** | Browse all registered students with matric badge, name, gender, level, department, allocation status. Search and filter by class level. |
| **Allocation management** | View all allocations, revoke individual allocations (with reason), view room-level occupancy. |
| **Transaction records** | View all payment transactions with Paystack reference, HMS reference, amount, status, and study type breakdown. Revenue summary cards. |
| **Natural language query** | Type plain English questions (e.g. "How many female 200L students are allocated in Block A?"). Gemini generates a validated read-only SQL query; results shown as a table. SQL toggle shows the generated query. |
| **Report builder** | Select filters and display columns from a predefined catalogue spanning students, payments, allocations, sessions, and hostels. Live preview table. CSV export. |
| **Audit trail** | Paginated, searchable log of all 22 event types with actor, action, target, timestamp, and metadata. CSV export. |
| **Dashboard statistics** | Total students, total beds, occupied beds, occupancy rate, active allocations, pending payments, total revenue, current session status. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS 4, React Router 7 |
| State / Context | React Context API (`SettingsContext`, `ToastContext`) |
| HTTP Client | Axios (JWT interceptor, auto token attach) |
| Charts | Recharts, Chart.js |
| SSE | Native `EventSource` API |
| Backend | Python FastAPI, Gunicorn + Uvicorn (ASGI) |
| Auth | bcrypt (passlib) + JWT (python-jose) |
| Database | PostgreSQL (Supabase cloud) via psycopg2 |
| AI — Compatibility | NumPy (weighted cosine similarity) |
| AI — NL Query | Google Gemini API via OpenRouter (read-only SQL generation) |
| AI — Match Summary | Google Gemini API (natural language allocation explanation) |
| Payment | Paystack API (card, bank transfer, USSD) |
| Frontend Deploy | Vercel |
| Backend Deploy | Render (Docker) |

---

## Architecture

```
AI-hms/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── database.py                # psycopg2 connection pool + get_cursor()
│   ├── dependencies.py            # get_current_user(), get_current_admin()
│   ├── models.py                  # Pydantic request/response schemas
│   ├── schema.sql                 # Full DDL: 15 tables + allocate_bed() function
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py                # Register, login, change-password
│   │   ├── allocation.py          # Dashboard, application, quiz, allocation
│   │   └── admin.py               # Sessions, hostels, students, stats, etc.
│   └── services/
│       ├── auth.py                # JWT encode/decode, bcrypt helpers
│       ├── ocr.py                 # Gemini Vision receipt parsing
│       ├── eligibility_ocr.py     # OCR eligibility check
│       ├── compatibility.py       # Weighted cosine similarity
│       ├── paystack.py            # Paystack API wrapper
│       ├── gemini.py              # Gemini NL → SQL + match summary
│       ├── receipt.py             # HMS reference generation
│       ├── audit_logger.py        # Centralised audit log writer
│       └── report_builder.py      # Dynamic SQL for report builder
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json                # SPA rewrite: /* → /index.html
│   ├── .env.example
│   └── src/
│       ├── main.jsx               # App root, SettingsProvider, ToastProvider
│       ├── App.jsx                # All routes, layouts, ProtectedRoute
│       ├── index.css              # TailwindCSS 4 theme + glassmorphism utilities
│       ├── api/
│       │   └── client.js          # Axios instance (VITE_API_URL base, Bearer token)
│       ├── context/
│       │   └── SettingsContext.jsx # Font + dark mode — persisted to localStorage
│       ├── components/
│       │   ├── Sidebar.jsx         # Student portal sidebar (collapsible)
│       │   ├── AdminSidebar.jsx    # Admin portal sidebar (5 sections, collapsible)
│       │   └── Toast.jsx           # Toast notification system
│       └── pages/
│           ├── LandingPage.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx
│           ├── HostelApplication.jsx
│           ├── Payment.jsx
│           ├── CompatibilityQuiz.jsx
│           ├── MyAllocation.jsx
│           ├── Settings.jsx        # Font picker, dark mode toggle, change password
│           └── admin/
│               ├── AdminDashboard.jsx
│               ├── AdminSessions.jsx
│               ├── AdminRegisterImport.jsx
│               ├── AdminFeeComponents.jsx
│               ├── AdminHostels.jsx
│               ├── AdminBlocks.jsx
│               ├── AdminBedSpaces.jsx
│               ├── AdminStudents.jsx
│               ├── AdminAllocations.jsx
│               ├── AdminRoomStudents.jsx
│               ├── AdminTransactions.jsx
│               ├── AdminReports.jsx
│               └── AdminAuditLogs.jsx
├── render.yaml                    # Render deployment config (env var declarations)
├── DEPLOYMENT.md                  # Full deployment guide with all env var tables
└── .gitignore
```

---

## Database Schema

Fifteen tables in Third Normal Form. The `allocate_bed()` stored function encapsulates the entire allocation algorithm in a single atomic transaction.

| Table | Purpose |
|-------|---------|
| `users` | Students and admins. Matric number as identifier. Bcrypt password hash. |
| `academic_sessions` | Session records with active flag and per-portal toggle booleans. |
| `session_register` | Imported CSV rows — enrolled student records for a specific session. |
| `fee_components` | Named fee components per session and study type (Accommodation, Electricity Levy, etc.). |
| `hostels` | Hostel definitions with gender restriction and capacity. |
| `blocks` | Blocks within a hostel. |
| `rooms` | Rooms within a block with capacity and status. |
| `beds` | Individual bed spaces: vacant / occupied / maintenance. |
| `applications` | Student hostel preference submissions (3 ranked choices). |
| `payments` | Paystack transaction records with HMS reference, amount, and status. |
| `compatibility_profiles` | Stored 8-dimensional lifestyle vectors per student per session. |
| `allocations` | Student-to-bed assignments with compatibility score. Unique per student per session; unique per bed per session. |
| `compatibility_scores` | Pairwise similarity scores between students in the same room. |
| `audit_logs` | Append-only event log. INSERT-only permissions. JSONB metadata. |
| `reports` | Saved report builder configurations. |

**Key constraints:**
- `UNIQUE(student_id, session_id)` on `allocations` — one bed per student per session.
- `UNIQUE(bed_id, session_id)` on `allocations` — one student per bed per session.
- `audit_logs` — application DB user has INSERT permission only; UPDATE and DELETE are denied at the database level.

---

## Allocation Algorithm

The allocation algorithm runs inside the `allocate_bed()` PostgreSQL stored function for full atomicity.

**Input:** student ID, session ID, ordered list of 3 hostel preference IDs.

**Steps:**
1. Reject if student already allocated this session.
2. Fetch the student's 8-dimensional lifestyle vector from `compatibility_profiles`.
3. For each hostel preference (1 → 2 → 3):
   - Find all rooms in the hostel with at least one vacant bed.
   - For each room, retrieve the lifestyle vectors of current occupants.
   - Compute **weighted cosine similarity** (NumPy) between the incoming student and each occupant. Average the scores across all occupants to get a room-level compatibility score.
   - Rank rooms by descending compatibility score.
   - For the top-scoring room, acquire a row-level lock with `SELECT FOR UPDATE SKIP LOCKED` on a vacant bed.
   - If the bed is locked by a concurrent transaction, skip to the next candidate.
4. Mark the bed as `occupied`, insert the allocation record with the compatibility score, insert pairwise scores into `compatibility_scores`.
5. If all three hostel preferences are full or locked, raise an exception — no partial state is committed.

**Concurrency safety:** `SELECT FOR UPDATE SKIP LOCKED` ensures two students competing for the last bed do not both succeed. The loser skips to the next available room without blocking or deadlocking.

**Dimension weights** (sourced from Adeniyi et al., 2024 — Nigerian university hostel conflict literature):

| Dimension | Weight |
|-----------|--------|
| Sleep time | 0.20 |
| Wake time | 0.15 |
| Study noise preference | 0.15 |
| Cleanliness | 0.15 |
| Visitor frequency | 0.10 |
| Night device use | 0.10 |
| Social preference | 0.10 |
| Noise tolerance | 0.05 |

---

## Payment Flow

1. **Initialise** — Backend calls Paystack `/transaction/initialize` with the student's study-type fee total and a callback URL. Returns an `authorization_url`.
2. **Checkout** — Student is redirected to the Paystack-hosted page. Completes payment via card, bank transfer, or USSD.
3. **Callback** — Paystack redirects to `PAYSTACK_CALLBACK_URL` with a `reference` query param. Backend opens an SSE stream, verifies the transaction via `/transaction/verify/{reference}`, confirms the amount matches, marks the payment confirmed, and generates the HMS receipt reference.
4. **Webhook** — Paystack also sends a server-to-server `charge.success` webhook as a backup, independent of the browser completing the redirect.
5. **HMS Reference** — Format: `HMS/YYYY/XXXXX` where `YYYY` is from the active session and `XXXXX` is a zero-padded sequential number.

---

## Audit Trail

22 event categories recorded in `audit_logs`:

`USER_REGISTERED` · `USER_LOGIN` · `USER_LOGOUT` · `PASSWORD_CHANGED` · `PROFILE_UPDATED` · `SESSION_CREATED` · `SESSION_ACTIVATED` · `PORTAL_TOGGLED` · `REGISTER_IMPORTED` · `FEE_COMPONENT_CREATED` · `FEE_COMPONENT_UPDATED` · `FEE_COMPONENT_DELETED` · `HOSTEL_CREATED` · `BLOCK_CREATED` · `ROOMS_GENERATED` · `APPLICATION_SUBMITTED` · `PAYMENT_INITIATED` · `PAYMENT_CONFIRMED` · `QUIZ_SUBMITTED` · `ALLOCATION_CREATED` · `ALLOCATION_REVOKED` · `ADMIN_NL_QUERY`

Each record stores: `event_type`, `actor_type` (student / admin / system), `actor_id`, `target_type`, `target_id`, `metadata` (JSONB), `ip_address`, `created_at`.

Immutability is enforced at the database level — the application DB user holds `INSERT` permission only on `audit_logs`. Any `UPDATE` or `DELETE` attempt results in a database-level permission error.

---

## API Reference

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/v1/allocation/check?matric=` | Public allocation lookup by matric number |

### Auth — `/api/v1/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Register (validates matric against session register) |
| `POST` | `/login` | Login — returns JWT access token |
| `POST` | `/change-password` | Change password (Bearer token + current password required) |

### Student — `/api/v1/allocation` _(Bearer token required)_

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard` | Full dashboard data |
| `PATCH` | `/profile` | Update email, phone, department, level |
| `GET` | `/hostels` | Available hostels filtered by student gender |
| `GET` | `/fee-summary` | Itemised fee components for student's study type |
| `POST` | `/apply` | Submit hostel application (3 ranked preferences) |
| `POST` | `/payment/initiate` | Initialise Paystack transaction |
| `GET` | `/payment/callback` | SSE stream — verify payment + generate HMS reference |
| `POST` | `/quiz` | Submit compatibility questionnaire, trigger allocation |
| `GET` | `/my-allocation` | Current allocation + roommates + compatibility scores |

### Admin — `/api/v1/admin` _(Admin Bearer token required)_

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create academic session |
| `GET` | `/sessions` | List all sessions |
| `PATCH` | `/session/{id}/activate` | Set active session |
| `PATCH` | `/session/{id}/toggle` | Open/close a portal phase |
| `POST` | `/register/import` | Upload session register CSV |
| `POST` | `/fee-components` | Create fee component |
| `GET` | `/fee-components` | List fee components for active session |
| `PATCH` | `/fee-components/{id}` | Update fee component |
| `DELETE` | `/fee-components/{id}` | Delete fee component |
| `POST` | `/hostels` | Create hostel |
| `GET` | `/hostels` | List hostels with occupancy stats |
| `POST` | `/hostels/{id}/blocks` | Create block in hostel |
| `POST` | `/blocks/{id}/rooms` | Bulk-generate rooms and beds |
| `GET` | `/students` | Student directory (search + filter) |
| `GET` | `/allocations` | All allocations |
| `DELETE` | `/allocations/{id}` | Revoke allocation |
| `GET` | `/rooms/{id}/students` | Students in a specific room |
| `GET` | `/transactions` | All payment records |
| `POST` | `/query` | Natural language query (Gemini → validated SQL → results) |
| `POST` | `/reports/preview` | Report builder live preview |
| `GET` | `/reports/export` | Report builder CSV export |
| `GET` | `/audit-logs` | Paginated audit trail |
| `GET` | `/audit-logs/export` | Audit trail CSV export |
| `GET` | `/stats` | Dashboard statistics |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Paystack account (test keys for development)
- Google Gemini API key
- OpenRouter API key (for NL query routing)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # fill in all values

# Run schema.sql against your PostgreSQL instance (Supabase SQL editor or psql)

python create_admin.py            # seed the first admin account

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
# API defaults to http://localhost:8000/api/v1 — no .env needed locally
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_HOST` | PostgreSQL host |
| `DATABASE_PORT` | PostgreSQL port (Supabase: `6543`) |
| `DATABASE_NAME` | Database name |
| `DATABASE_USER` | Database user |
| `DATABASE_PASSWORD` | Database password |
| `JWT_SECRET` | Token signing secret (long random string) |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRY_MINUTES` | `1440` (24 hours) |
| `UPLOAD_DIR` | `./uploads` |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `OPENROUTER_API_KEY` | OpenRouter key — routes NL queries to Gemini Flash |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (`sk_test_...` or `sk_live_...`) |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `PAYSTACK_CALLBACK_URL` | Full URL of the payment callback page on the frontend |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Frontend (Vercel environment variables)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL — e.g. `https://your-backend.onrender.com/api/v1` |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full step-by-step guide with all Render and Vercel environment variable values.

### Backend → Render

1. Connect repo at [render.com](https://render.com), root directory `backend`, runtime Docker.
2. Render reads `render.yaml` — all env var keys are pre-declared.
3. Fill in values in the Render **Environment** tab.

### Frontend → Vercel

1. Import repo at [vercel.com](https://vercel.com), root directory `frontend`.
2. Framework: Vite (auto-detected).
3. Add `VITE_API_URL` in **Settings → Environment Variables**.

---

## Settings

Accessible from the profile dropdown (top-right avatar icon).

**Appearance**
- Font: Inter (default), System UI (native OS / Claude-like), Georgia (serif), JetBrains Mono
- Dark mode toggle

**Security**
- Change password (requires current password + password strength meter)

Font and dark mode preferences persist in `localStorage` and apply globally via `document.documentElement` class manipulation.

---

## License

MIT
