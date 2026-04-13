#!/usr/bin/env bash
set -e

echo "🚀 data sync start"

echo "1) sync full exchange ticker universe"
node scripts/sync-tickers.mjs

echo "2) sync S&P 500 constituents"
node scripts/sync-sp500-constituents.mjs

echo "3) sync S&P 500 metadata"
node scripts/sync-sp500-metadata.mjs

echo "✅ data sync done"
