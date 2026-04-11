#!/usr/bin/env bash
set -e

# env 로드
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

DB_NAME="geo_portfolio"
DB_OWNER="geo_master"
SQL_FILE="./db/init.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "$SQL_FILE"

echo "Initialized '$DB_NAME' with $SQL_FILE as '$DB_OWNER'"
