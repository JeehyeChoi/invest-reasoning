# geo-portfolio

A data-driven portfolio intelligence system for long-term investing.

This project is evolving from a portfolio tracker into a **full investment data + factor + reasoning engine**, combining:

- structured financial data pipelines (SEC, APIs)
- normalized financial time-series
- factor-based modeling
- workflow-based analysis
- (optional) LLM-assisted reasoning

---

## ✨ What This Is

Not just a tracker.

This is a **multi-layer investment system** that:

- builds a structured dataset (prices, metadata, filings, fundamentals)
- normalizes raw financial data into analysis-ready time series
- computes factor signals (growth, quality, etc.)
- analyzes portfolio exposure
- supports decision-making workflows

---

## 🔍 Current Capabilities (Implemented)

The system now supports a full vertical slice from raw SEC data to visualized metrics:

- ticker detail page (`/tickers/[ticker]`)
- quarterly financial series extraction (SEC CompanyFacts)
- normalization of financial data (YTD → quarterly reconstruction)
- Q4 reconstruction from annual filings
- consistent time labeling via `display_frame`
- interactive chart visualization (headline metrics)
- filing parsing (items / exhibits) with signal extraction

This represents the first fully connected pipeline:

```
SEC raw data
    ↓
normalized quarterly series
    ↓
factor computation
    ↓
API layer
    ↓
UI (chart + interpretation)
```

---

## 🧠 System Layers

```text
Raw Data (SEC / APIs)
        ↓
Structured Storage (PostgreSQL)
        ↓
Normalization Layer (quarterly reconstruction)
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
- flexible portfolio input
- buy-only rebalancing logic
- target weight tracking
- status classification:
  - On target
  - Overweight
  - Rebalancing needed

---

### 2. Market Data System
- batched price fetching (TwelveData)
- rate-limit aware
- cached fallback
- US market status detection

---

### 3. Filings System (SEC)
- recent filings discovery
- filing parsing (items / exhibits)
- SEC document fetch
- signal extraction (e.g. dividend from 8-K)

---

### 4. Factor System

Factor-based modeling structure:

```text
Factor (e.g. growth)
    ├── fundamentals_based
    ├── etf_implied
    └── narrative_implied
```

#### Implemented

- revenue growth (fundamentals)
  - quarterly normalization from SEC YTD data
  - Q4 reconstruction from annual filings
  - deduplication of overlapping filings
  - consistent time alignment via `display_frame`
  - growth metrics:
    - YoY
    - QoQ
    - consistency
    - acceleration

---

### 5. Data Pipeline

Data sources:

- SEC (companyfacts, filings)
- TwelveData (prices)
- FMP (fallback financials)

#### SEC CompanyFacts Bulk Ingestion (LIVE)

- SEC `companyfacts.zip` 기반 bulk ingestion
- S&P 500 universe filtering
- idempotent ingestion (safe to re-run)

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

## 🔄 Financial Series Normalization

SEC data is not directly usable for analysis.

This system performs:

- YTD → quarterly conversion
- Q4 reconstruction from annual filings
- deduplication of overlapping reports
- handling missing quarters (no artificial fill)
- consistent labeling via `display_frame`

Result:

→ clean, analysis-ready quarterly time series

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
Next.js (ticker detail + charts)
```

---

## 🖥 UI Layer

- ticker detail page (`/tickers/[ticker]`)
- headline metric chart (quarterly bar chart)
- hover-based date inspection
- factor interpretation display
- filings + signals integration

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

### Factor Snapshot (growth/revenue implemented)

```text
backend/workflows/ticker-factor-snapshot/
```

Steps:

1. fetch normalized quarterly series
2. compute growth metrics (yoy, qoq, consistency, acceleration)
3. compute factor score
4. build snapshot
5. persist snapshot
6. expose via API

---

## 🗄 Data Strategy

### Raw vs Computed

**Raw**
- SEC companyfacts
- filings

**Computed**
- normalized quarterly series
- growth metrics
- factor scores
- portfolio signals

---

### Ingestion Strategy

- bulk ingestion (SEC companyfacts)
- incremental updates (planned)
- ETF-derived universe expansion (planned)

---

## 🔮 Future Work

### Data
- expand universe (S&P 1500 / ETF-derived)
- concept normalization layer
- incremental updates

### Factor System
- net income
- operating cash flow
- free cash flow
- multi-factor aggregation

### Portfolio
- scenario simulation
- portfolio history tracking

### Analysis
- narrative signal extraction (RAG)
- explainable factor reasoning

---

## 📌 Direction

This project is moving toward:

> **a full investment data + factor + reasoning system**

not just a portfolio tracker.
