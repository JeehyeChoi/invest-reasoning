#!/usr/bin/env bash
set -e

echo "🚀 bootstrap start"

echo "------------------------"
echo "-- prepare database --"
echo "------------------------"
#sh scripts/db/create.sh

echo " "
echo "----------------------------"
echo "-- initialize DB schema --"
echo "----------------------------"
#sh scripts/db/init.sh

echo " "
echo "--------------------------------"
echo "-- initialize classification tag definitions --"
echo "--------------------------------"
node scripts/bootstrap/classification-tags/extract-definition-candidates.mjs
node scripts/bootstrap/classification-tags/import-definitions.mjs

echo " "
echo "-----------------------------------"
echo "-- initialize factor definitions --"
echo "-----------------------------------"
node scripts/bootstrap/factors/import-definitions.mjs

echo " "
echo "✅ bootstrap done"
