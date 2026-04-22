#!/usr/bin/env bash
set -e

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi


DB_NAME="geo_portfolio"
DB_OWNER="geo_master"

echo "🚀 schema init start"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_core.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/tag_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/factor_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/factor_score_axis_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_score_snapshots.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_bulk_ingest_state.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_raw.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_company_state.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_series.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "db/ticker_factor_metrics.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_submissions_raw.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_frames_raw.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/model_versions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/scenario_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/scenario_factor_shocks.sql"

echo "✅ schema init done"
