# geo-portfolio

A portfolio reasoning system for long-term investing.

This project combines structured data pipelines, factor modeling, and LLM-driven workflows to help analyze and reason about investment portfolios — beyond simple tracking.

---

## ✨ What This Is

Not just a portfolio tracker.

This is a **decision-support system** that:

- understands your portfolio structure
- evaluates exposure (sector, tags, etc.)
- suggests rebalancing actions
- generates structured analysis using LLM workflows

---

## ⚡ Quick Start

```bash
git clone https://github.com/JeehyeChoi/invest-reasoning.git
cd geo-portfolio

npm install
cp .env.sample .env.local
sh scripts/bootstrap.sh
npm run dev
```

Open: http://localhost:3000

---

## 🧠 Key Features

### Portfolio Engine
- Flexible input (partial data allowed)
- Edit modes:
  - total cost basis
  - average price basis
- Buy-only rebalancing (based on excess cash)
- Target weight tracking
- Status:
  - On target
  - Overweight
  - Rebalancing needed

### Pricing System
- Batched price fetching (free-tier safe)
- 8 tickers per request
- Progressive loading UI
- Cached fallback on API failure

### Analysis Engine
- Exposure analysis (sector / tag / country)
- Multi-step LLM workflow:
  - planning
  - analysis
  - verification
  - report generation

### Data System
- PostgreSQL-backed structured storage
- Tag definitions
- Factor definitions
- Scenario modeling (early stage)

---

## 🏗 Architecture

```text
Portfolio Input
    ↓
Price + Metadata Enrichment
    ↓
Exposure Analysis
    ↓
LLM Workflow (plan → analyze → verify → report)
    ↓
Structured Output
```

---

## 📁 Project Structure

```text
src/
  app/                  # Next.js routes (UI + API)
  backend/              # workflows / services / agents
  features/             # portfolio / analysis
  shared/               # types / utils / constants

db/                     # modular SQL schema
scripts/                # data + setup pipelines
lab/                    # design / notes
```

---

## 🚀 Bootstrap Pipeline

```bash
sh scripts/bootstrap.sh
```

Initializes everything:

- database schema
- ticker + metadata sync
- tag definitions
- factor definitions

This is the **required first step** before running the app.

---

## ⚙️ Environment Variables

Create `.env.local` from `.env.sample`:

```bash
cp .env.sample .env.local
```

Required:

```env
TWELVE_DATA_API_KEY=
FMP_API_KEY=
ANTHROPIC_API_KEY=

DATABASE_URL=
DB_PASSWORD=
```

---

## 🧩 Workflow Overview

Located in:

```text
backend/workflows/portfolio-analysis/
```

Steps:

1. Resolve metadata
2. Infer tags
3. Compute exposure
4. Generate analysis plan
5. Run LLM analysis
6. Verify results
7. Build final report

---

## 📝 Notes

- `.env.local` should NOT be committed
- PostgreSQL must be running before bootstrap
- Free-tier APIs are rate-limited (batched internally)
- Cached prices may be used on API failure

---

## 🔮 Future Work

- Factor scoring engine
- Scenario simulation
- Portfolio history tracking
- Visualization improvements
- Multi-source price aggregation
