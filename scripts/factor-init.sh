#!/bin/bash
set -e

echo "🚀 init factors pipeline start"

echo "1) import factor definitions into DB"
node scripts/import-factor-definitions.mjs

echo "✅ init factors pipeline done"
