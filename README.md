# Meridian — Canadian Municipal Procurement Intelligence

**Live Demo:** [meridian-democom-mukund084s-projects.vercel.app](https://meridian-democom-mukund084s-projects.vercel.app/)

Meridian is a pre-RFP procurement intelligence platform that crawls Canadian municipal websites (GTA region), extracts actionable signals from council meetings, budgets, and tender listings, and surfaces them through a modern dashboard — helping vendors identify opportunities before formal RFPs are published.

## What It Does

- **Crawls bid portals** (bidsandtenders.ca) for municipal tenders, extracting status, pricing, plan takers, and submission details
- **Scrapes meeting calendars** (escribemeetings.com) for council agendas and minutes
- **Extracts signals from PDFs** using LLM analysis (Grok/XAI) across 15 procurement-relevant categories: budget, timing, scope, decision-makers, infrastructure, technology, and more
- **Scores and ranks signals** by actionability using a weighted formula (category weight × confidence × procurement stage × richness)
- **Aggregates city profiles** with contacts, recent bids, signals, and meeting history

## Architecture

```
┌──────────────────────────────────────────────────┐
│            Frontend (Next.js 16 / React 19)      │
│  Dashboard · Bids · Meetings · Signals · Accounts│
│         Tailwind CSS 4 · Material Design 3       │
└────────────────────┬─────────────────────────────┘
                     │ REST (JSON)
┌────────────────────▼─────────────────────────────┐
│              Backend (FastAPI :8000)              │
│    /bids  /meetings  /signals  /accounts /search │
│           TTL-cached · Paginated                 │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│           Database (Supabase / PostgreSQL)        │
│     bids · meetings · signals · pdf_documents    │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              Crawling & Extraction Pipeline       │
│  Playwright crawlers → PDF download (PyMuPDF)    │
│  → Text chunking → LLM signal extraction (Grok) │
│  → Scored signals upserted to Supabase           │
└──────────────────────────────────────────────────┘
```

### Key Components

| Directory | Purpose |
|-----------|---------|
| `api.py` | FastAPI application — all REST endpoints |
| `backend/crawlers/` | Playwright-based scrapers for bids and meetings |
| `backend/extractors/` | PDF download and text extraction |
| `backend/agents/` | LLM-powered signal extraction and orchestration |
| `backend/models/` | Pydantic data models (bids, meetings, signals) |
| `backend/db/` | Supabase client and upsert operations |
| `frontend/src/app/` | Next.js pages (dashboard, bids, meetings, signals, accounts) |
| `frontend/src/components/` | Reusable UI components (data tables, filters, charts) |
| `storage/` | Local cache for PDFs, extracted text, and datasets |

## How to Run

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project with tables for `bids`, `meetings`, `signals`, and `pdf_documents`
- A [Grok/XAI](https://x.ai) API key for signal extraction

### 1. Environment Setup

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
APP_ENV=development
ENABLE_API_DOCS=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
XAI_API_KEY=xai-your-key
PDF_DOWNLOAD_DIR=storage/pdfs
PDF_TEXT_CACHE_DIR=storage/text_cache
PDF_ALLOWED_HOSTS=escribemeetings.com
PDF_REDIRECT_LIMIT=5
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ALLOWED_HOSTS=localhost,127.0.0.1,::1
RATE_LIMIT_REQUESTS=120
EXPENSIVE_RATE_LIMIT_REQUESTS=20
RATE_LIMIT_WINDOW_SECONDS=60
```

Keep `.env` server-only. Do not commit real Supabase or XAI credentials. In production, set `APP_ENV=production`, use your real API hostname in `ALLOWED_HOSTS`, and leave `ENABLE_API_DOCS` unset or `false` unless you explicitly want docs exposed.

### 2. Backend

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .

# Install Playwright browsers
playwright install

# Start the API server
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Check `http://localhost:8000/health` to verify. If you access it through a different hostname in development, add that hostname to `ALLOWED_HOSTS`.

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Ensure NEXT_PUBLIC_API_URL=http://localhost:8000

# Start dev server
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### 4. Running Crawlers

With the backend environment activated:

```bash
# Run the orchestrator to crawl bids, meetings, and extract signals
python backend/agents/orchestrator_agent.py
```

This will crawl configured municipalities (default: Mississauga, Vaughan, Markham), download PDFs, extract text, run LLM signal analysis, and upsert everything to Supabase.

### Running Tests

```bash
pip install -e ".[dev]"
pytest
```
