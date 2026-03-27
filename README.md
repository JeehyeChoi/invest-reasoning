# Invest-reasoning

Invest-reasoning Portfolio is a lightweight portfolio management app designed to explore AI-assisted investment analysis workflows.

---

## Demo

- Add portfolio positions (stocks + cash)
- Track current weights based on live prices
- Persist data locally
- Run AI-based portfolio analysis (Claude/OpenAI)

---

## Features

- Portfolio input with flexible fields (shares / avg price / total cost)
- Automatic calculation of missing values
- Real-time price fetching via Twelve Data API
- Current portfolio weight calculation
- Local storage persistence (state recovery on reload)
- AI analysis integration (Claude / OpenAI)
- Strategy-based analysis (macro, valuation, papic)

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- React
- Tailwind CSS
- Zod (runtime validation)
- Claude / OpenAI API

---

## Architecture

This project follows a contract-first layered architecture:

- `app/` → UI & routing
- `features/` → domain-specific logic (portfolio, analysis)
- `shared/` → shared types and utilities
- `backend/` → API clients and server-side logic

### Key principles

- Separation of frontend and backend concerns
- Prompt builder pattern for LLM interaction
- Runtime validation using Zod

---

## API Flow

1. User inputs portfolio data  
2. Prices are fetched via `/api/prices`  
3. Portfolio metrics are calculated  
4. Analysis request is sent to `/api/analyze`  
5. LLM returns structured analysis  

---

## Getting Started

```bash
git clone https://github.com/your-repo.git
cd geo-portfolio
npm install
npm run dev
```

---

## Environment Variables

Create `.env.local`:

```
TWELVE_DATA_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
```

---

## Future Work
- Advanced portfolio analysis models (macro / geopolitical / valuation)
- RAG-based financial knowledge integration
- Automated data ingestion (news, macro indicators)
- Multi-strategy comparison UI
