# geo-portfolio

A **data-driven investment reasoning system** that transforms messy financial data into structured signals for portfolio decisions.

---

## 🎯 Core Idea

Financial data is not analysis-ready.

SEC filings contain:
- overlapping periods  
- cumulative (YTD) values  
- multiple tag variants for the same concept  
- irregular reporting patterns (e.g. retail calendars)

This project builds a pipeline that converts raw filings into:

→ **clean, consistent quarterly time series**  
→ **factor signals (growth, quality, etc.)**  
→ **portfolio-level decision inputs**

---

## ⚙️ What This System Does

- builds structured datasets from SEC filings and market data  
- normalizes raw financial data into **analysis-ready time series**  
- computes factor signals (growth, fundamentals)  
- supports portfolio analysis and decision workflows  

---

## 🔄 Financial Series Normalization (Key Feature)

This system reconstructs reliable quarterly data from raw SEC companyfacts.

### Handles:

- YTD → quarterly conversion  
- Q4 reconstruction from annual filings  
- multi-tag stitching (e.g. revenue variants → one metric)  
- deduplication (latest filing per period)  
- company-specific period detection (3m / 6m / 9m / 12m)  
- outlier quarters (e.g. 112-day retail cycles)  
- quarter continuity (gap / overlap resolution)  
- duration-based validation using statistical profiles  

### Result:

→ **clean quarterly series across companies with inconsistent reporting**  
→ usable for factor modeling and time-series analysis  

---

## 📊 Factor System

Currently implemented:

### Growth (Fundamentals)

Core metrics:
- revenue  
- net income  
- operating income  

Pipeline features:
- normalized quarterly data  
- consistent time alignment (`display_frame`)  
- continuity-aware selection  

Growth signals:
- YoY growth  
- QoQ growth  
- consistency  
- acceleration  

---

## 🧠 System Architecture

```text
Raw Data (SEC / APIs)
        ↓
Normalization (time-series reconstruction)
        ↓
Factor Computation
        ↓
Portfolio Analysis
        ↓
(optional) LLM-assisted reasoning
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/<your-repo>
cd geo-portfolio
```

---

## 🔮 Future Work

- expand universe (S&P 1500, ETF-derived)
- additional flow metrics (OCF, FCF)
- multi-factor aggregation
- narrative signal extraction (RAG)

---

## 💡 Summary

This project is not just a tracker.

It is a **financial data normalization + factor modeling engine**, designed to:

→ handle real-world messy data  
→ produce reliable analytical signals  
→ support structured investment decision-making
