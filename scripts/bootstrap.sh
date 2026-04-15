#!/usr/bin/env bash
set -e

echo "🚀 bootstrap start"

echo "--------------------------"
echo "-- initialize DB schema --"
echo "--------------------------"
#sh scripts/db-init.sh

echo " "
echo "----------------------"
echo "-- sync source data --"
echo "----------------------"
#sh scripts/data-sync.sh

echo " "
echo "--------------------------------"
echo "-- initialize tag definitions --"
echo "--------------------------------"
sh scripts/tag-init.sh

echo " "
echo "-----------------------------------"
echo "-- initialize factor definitions --"
echo "-----------------------------------"
sh scripts/factor-init.sh

echo " "
echo "✅ bootstrap done"
