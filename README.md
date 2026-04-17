# geo-portfolio

A portfolio intelligence system for long-term investing.

This project is evolving from a portfolio tracker into a **data-driven investment reasoning engine**, combining:

- structured financial data pipelines (SEC, APIs)
- factor-based modeling
- workflow-based analysis
- (optional) LLM-assisted reasoning

---

## ✨ What This Is

Not just a tracker.

This is a **multi-layer investment system** that:

- builds a structured dataset (prices, metadata, filings, fundamentals)
- computes factor signals (growth, quality, etc.)
- analyzes portfolio exposure
- supports decision-making workflows

---

## 🧠 System Layers

```text
Raw Data (SEC / APIs)
        ↓
Structured Storage (PostgreSQL)
        ↓
Factor Computation (fundamentals / narrative / ETF)
        ↓
Portfolio Analysis (exposure / rebalancing)
        ↓
(Optionally) LLM Reasoning
```

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

## 🧩 Core Modules

### 1. Portfolio Engine
- Flexible portfolio input
- Buy-only rebalancing logic
- Target weight tracking
- Status classification:
  - On target
  - Overweight
  - Rebalancing needed

---

### 2. Market Data System
- Batched price fetching (TwelveData)
- Rate-limit aware
- Cached fallback
- US market status detection (open / closed / holiday)

---

### 3. Filings System (SEC)
- Recent filings discovery
- Filing parsing (items / exhibits)
- SEC document fetch
- CIK-based lookup

---

### 4. Factor System (NEW)

Factor-based modeling structure:

```text
Factor (e.g. growth)
    ├── fundamentals_based
    ├── etf_implied
    └── narrative_implied
```

Each factor:
- consumes structured data
- produces axis-based scores
- is stored as snapshots

Example (in progress):
- revenue growth (fundamentals)

---

### 5. Data Pipeline

Data sources:

- SEC (companyfacts, filings)
- TwelveData (prices)
- FMP (fallback / structured financials)

### SEC CompanyFacts Bulk Ingestion (LIVE)

- SEC `companyfacts.zip` 기반 bulk ingestion 구현 완료
- S&P 500 universe 기준 필터링
- idempotent ingestion (중복 실행 안전)

Key behavior:

- archive 변경 없으면 ingest skip
- ingest 완료 상태 유지 (재실행 방지)
- 실패 시 재실행 가능 (resume-safe)

Pipeline:

```text
SEC bulk archive
    ↓
Scan (CIK filtering + change detection)
    ↓
Process (per company facts)
    ↓
Flatten → normalize
    ↓
Store (PostgreSQL)
    ↓
Update ingest state
```

---

## 🏗 Architecture

```text
[ Ingestion ]
SEC / APIs
    ↓
[ Storage ]
PostgreSQL (raw + normalized)
    ↓
[ Services ]
data access / transformation
    ↓
[ Workflows ]
factor computation / portfolio analysis
    ↓
[ UI / API ]
Next.js
```

---

## 📁 Project Structure

```text
src/
  app/                      # Next.js routes (UI + API)

  backend/
    clients/               # external API clients (SEC, FMP, TwelveData)
    services/              # data access + domain logic
    workflows/             # orchestration pipelines

  features/                # domain features (portfolio, filings, market)

  shared/
    schemas/               # shared types
    utils/                 # shared utilities
    constants/             # shared constants

db/                         # SQL schema
scripts/                    # setup + bootstrap scripts
lab/                        # design notes
```

---

## 🚀 Bootstrap Pipeline

```bash
sh scripts/bootstrap.sh
```

Initializes:

- database schema
- base metadata
- factor definitions
- system setup

---

## ⚙️ Environment Variables

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

## 🔄 Workflows

### Portfolio Analysis

```text
backend/workflows/portfolio-analysis/
```

- metadata resolution
- exposure calculation
- (optional) LLM reasoning

---

### Factor Snapshot (in progress)

```text
backend/workflows/ticker-factor-snapshot/
```

Steps:

1. fetch factor inputs (SEC / DB)
2. compute metrics (e.g. revenue growth)
3. compute factor scores
4. build snapshot
5. persist snapshot

---

## 🗄 Data Strategy

### Raw vs Computed

- **Raw data**
  - SEC companyfacts
  - filings
- **Computed**
  - growth metrics
  - factor scores
  - portfolio signals

---

### Ingestion Strategy

- bulk ingestion (SEC companyfacts, implemented)
- incremental fetch (per ticker fallback, optional)
---

## 📝 Notes

- `.env.local` should NOT be committed
- PostgreSQL must be running before bootstrap
- APIs are rate-limited (batched internally)
- SEC data requires normalization (taxonomy differences)

---

## 🔮 Future Work

### Data
- expand universe (S&P 1500 / ETF-based)
- concept normalization layer (critical)
- incremental updates beyond bulk ingestion

### Factor System
- revenue growth implementation (next step)
- multi-factor model expansion
- factor snapshot persistence

### Portfolio
- scenario simulation
- portfolio history tracking

### Analysis
- LLM workflow separation
- explainable factor reasoning

---

## 📌 Direction

This project is moving toward:

> **a full investment data + factor + reasoning system**

not just a UI-based portfolio tool.
