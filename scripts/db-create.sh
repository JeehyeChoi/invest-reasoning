#!/usr/bin/env bash
set -e

# env 로드
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

DB_NAME="geo_portfolio"
DB_OWNER="geo_master"

echo "Checking user '${DB_OWNER}'..."

if psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_OWNER}'" | grep -q 1; then
  echo "User '${DB_OWNER}' already exists."
else
  psql -d postgres -c "CREATE USER ${DB_OWNER} WITH PASSWORD '${DB_PASSWORD}';"
  echo "User '${DB_OWNER}' created."
fi

echo "Checking database '${DB_NAME}'..."

if psql -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "Database '${DB_NAME}' already exists."
else
  createdb -O "$DB_OWNER" "$DB_NAME"
  echo "Database '${DB_NAME}' created with owner '${DB_OWNER}'."
fi
