# Deployment Guide — AI-Driven Hostel Management System

## Stack Overview

| Layer | Service | URL |
|-------|---------|-----|
| Backend | Render (Docker) | `https://ai-hms-nine.onrender.com` |
| Frontend | Vercel | `https://ai-hms-nine.vercel.app` |
| Database | Supabase (PostgreSQL) | `aws-1-eu-west-1.pooler.supabase.com:6543` |

---

## 1. Backend — Render

### Setup
1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect the GitHub repo: `Plutonian-coder/AI-hms`
3. Set **Root Directory** → `backend`
4. Set **Runtime** → `Docker`
5. Render auto-detects `render.yaml` — all env var keys are pre-declared there

### Environment Variables to Fill In

Go to **Environment** tab in Render and set these values:

#### Database (Supabase)
| Variable | Value |
|----------|-------|
| `DATABASE_HOST` | `aws-1-eu-west-1.pooler.supabase.com` |
| `DATABASE_PORT` | `6543` |
| `DATABASE_NAME` | `postgres` |
| `DATABASE_USER` | `postgres.jekpgzxzknojijfbuhbu` |
| `DATABASE_PASSWORD` | *(see hide.md or your saved keys)* |

#### Auth
| Variable | Value |
|----------|-------|
| `JWT_SECRET` | *(see hide.md)* |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRY_MINUTES` | `1440` |

#### AI / NL Query
| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | *(see hide.md — Google AI Studio key)* |
| `OPENROUTER_API_KEY` | *(see hide.md — OpenRouter key, used for NL query via Gemini Flash)* |

#### Payments
| Variable | Value |
|----------|-------|
| `PAYSTACK_SECRET_KEY` | *(see hide.md — starts with `sk_test_`)* |
| `PAYSTACK_PUBLIC_KEY` | *(see hide.md — starts with `pk_test_`)* |
| `PAYSTACK_CALLBACK_URL` | `https://ai-hms-nine.vercel.app/payment/callback` |

#### Misc
| Variable | Value |
|----------|-------|
| `UPLOAD_DIR` | `./uploads` |
| `CORS_ORIGINS` | `http://localhost:5173,https://ai-hms-nine.vercel.app` |

---

## 2. Frontend — Vercel

### Setup
1. Go to [vercel.com](https://vercel.com) → **Add Project**
2. Import repo `Plutonian-coder/AI-hms`
3. Set **Root Directory** → `frontend`
4. Framework auto-detected as **Vite**

### Environment Variables

Go to **Settings → Environment Variables** in Vercel:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://ai-hms-nine.onrender.com/api/v1` |

---

## 3. Local Development

### Backend
```bash
cd backend
cp .env.example .env       # fill in values from hide.md
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
# No .env needed for local dev — defaults to http://localhost:8000/api/v1
npm install
npm run dev
```

---

## 4. Database Setup

Run the schema SQL once on Supabase:
```bash
# Connect to Supabase via psql or the Supabase SQL editor
# Run: backend/schema.sql
```

To seed an admin account:
```bash
cd backend
python create_admin.py
```

---

## 5. After Cloning on a New PC

1. Clone the repo:
   ```bash
   git clone https://github.com/Plutonian-coder/AI-hms.git
   cd AI-hms
   ```
2. Copy keys from `hide.md` into `backend/.env`
3. Delete `hide.md` immediately after:
   ```bash
   git rm hide.md
   git commit -m "chore: remove secrets file"
   git push
   ```

---

## 6. Key URLs

| Resource | URL |
|----------|-----|
| Live Frontend | https://ai-hms-nine.vercel.app |
| Live Backend API | https://ai-hms-nine.onrender.com/api/v1 |
| API Docs (Swagger) | https://ai-hms-nine.onrender.com/docs |
| GitHub Repo | https://github.com/Plutonian-coder/AI-hms |
| Supabase Dashboard | https://supabase.com/dashboard/project/jekpgzxzknojijfbuhbu |
