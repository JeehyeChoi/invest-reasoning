#!/bin/bash
set -e

echo "🚀 init tags pipeline start"

echo "1) extract tag definition candidates"
node scripts/extract-tag-definition-candidates.mjs

echo "2) import tag definitions into DB"
node scripts/import-tag-definitions.mjs

echo "✅ init tags pipeline done"
