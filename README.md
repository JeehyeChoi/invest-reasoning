# Invest-reasoning

A portfolio analysis tool that computes exposure, enriches metadata, and generates structured investment insights using LLM workflows.

---

## Features

- Portfolio input & weight calculation
- Real-time price fetching
- Metadata enrichment (company profile, tags)
- Exposure analysis (sector / industry / tag / country)
- LLM-based portfolio analysis
- PostgreSQL-based data persistence

---

## Tech Stack

- Frontend: Next.js (App Router), React
- Backend: Next.js API Routes
- Database: PostgreSQL
- LLM: Anthropic (Claude)

---

## Project Structure

src/
  app/                 # Next.js routes
  backend/
    workflows/         # portfolio analysis workflow engine
    services/          # metadata / market / DB logic
    config/            # env / db config
  features/
    portfolio/         # portfolio input + calculation
    analysis/          # analysis UI + prompts
  shared/
    types/             # shared types
    constants/         # static data

scripts/
  db-init.sh           # DB initialization
  db-create.sh         # DB creation
  sync-tickers.mjs     # ticker sync script

db/
  init.sql             # database schema

---

## Getting Started

git clone https://github.com/your-repo.git
cd geo-portfolio
npm install
npm run dev

Open http://localhost:3000

---

## Environment Variables

Create `.env.local` in the root directory:

TWELVE_DATA_API_KEY=your_key_here
FMP_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

DB_PASSWORD=your_db_password
DATABASE_URL=postgresql://geo_master:<password>@localhost:5432/geo_portfolio

Make sure to create .env.local before running the app.
Use .env.example as a template.

---

## Database Setup

Make sure PostgreSQL is running.

### 1. Create Database & User

bash scripts/db-create.sh

This will:
- Create database: geo_portfolio
- Create user: geo_master
- Set password (from env or script)
- Grant privileges

---

### 2. Initialize Schema

bash scripts/db-init.sh

This will:
- Create tables
- Create indexes
- Create triggers

---

### 3. Verify

psql postgresql://geo_master:<password>@localhost:5432/geo_portfolio

Then:

\dt

---

## Workflow Overview

1. Resolve metadata (DB + API)
2. Infer tags
3. Compute exposure
4. Generate analysis plan
5. Run LLM analysis
6. Verify and refine
7. Build final report

---

## Notes

- `.env.local` should NOT be committed
- PostgreSQL must be running before starting the app
- Metadata is cached in DB

---

## Future Work

- Macro / factor analysis layer
- Redis caching
- Portfolio history tracking
- Better visualization UI
- Real-time data pipeline
