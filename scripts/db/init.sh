#!/usr/bin/env bash
set -e

if [ -f .env.local.psql ]; then
  set -a
  source .env.local.psql
  set +a
fi


DB_NAME="geo_portfolio"
DB_OWNER="geo_master"

echo "🚀 schema init start"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_core.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_tags.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/universes.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/tag_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/factor_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/factor_axis_definitions.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_bulk_ingest_state.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_raw.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_company_state.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_company_fiscal_annual_periods.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_company_fiscal_quarter_periods.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_company_fiscal_profiles.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_company_fiscal_metric_sign_profiles.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_tag_series.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_metric_series.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_companyfact_metric_series_enriched.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_metric_features.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_metric_feature_baselines.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_metric_feature_positions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_signal_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_signals.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_metric_macro_contrasts.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_factor_metric_clusters.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/ticker_metric_series_reliability.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/fred_macro_series_observations.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_submissions_raw.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/sec_frames_raw.sql"

psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/model_versions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/scenario_definitions.sql"
psql -U "$DB_OWNER" -d "$DB_NAME" -f "./db/scenario_factor_shocks.sql"

echo "✅ schema init done"
