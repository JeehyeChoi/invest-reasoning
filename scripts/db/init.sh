#!/usr/bin/env bash
set -e

if [ -f .env.local.psql ]; then
  set -a
  source .env.local.psql
  set +a
fi


DB_NAME="geo_portfolio"
DB_OWNER="geo_master"

run_sql() {
  local file="$1"

  if [ -n "${DATABASE_URL:-}" ]; then
    psql "$DATABASE_URL" -f "$file"
  else
    psql -U "$DB_OWNER" -d "$DB_NAME" -f "$file"
  fi
}

echo "🚀 schema init start"

run_sql "./db/ticker_core.sql"
run_sql "./db/ticker_tags.sql"
run_sql "./db/universes.sql"
run_sql "./db/provider_api_usage_events.sql"
run_sql "./db/ticker_provider_symbols.sql"
run_sql "./db/ticker_daily_prices.sql"

run_sql "./db/tag_definitions.sql"
run_sql "./db/factor_definitions.sql"
run_sql "./db/factor_axis_definitions.sql"

run_sql "./db/sec_bulk_ingest_state.sql"

run_sql "./db/sec_companyfact_raw.sql"
run_sql "./db/sec_companyfact_company_state.sql"

run_sql "./db/sec_company_fiscal_annual_periods.sql"
run_sql "./db/sec_company_fiscal_quarter_periods.sql"
run_sql "./db/sec_company_fiscal_profiles.sql"
run_sql "./db/sec_company_fiscal_metric_sign_profiles.sql"

run_sql "./db/sec_companyfact_tag_series.sql"
run_sql "./db/sec_companyfact_tag_candidate_stats.sql"
run_sql "./db/sec_companyfact_metric_series.sql"
run_sql "./db/sec_companyfact_metric_series_experiment.sql"
run_sql "./db/sec_companyfact_metric_series_enriched.sql"
run_sql "./db/ticker_derived_metric_series.sql"
run_sql "./db/ticker_implied_financial_expectations.sql"

run_sql "./db/ticker_factor_metric_features.sql"
run_sql "./db/ticker_factor_feature_definitions.sql"
run_sql "./db/ticker_factor_metric_display_definitions.sql"
run_sql "./db/ticker_factor_axis_display_definitions.sql"
run_sql "./db/ticker_factor_signal_definitions.sql"
run_sql "./db/ticker_factor_signals.sql"
run_sql "./db/ticker_factor_metric_macro_contrasts.sql"
run_sql "./db/ticker_signal_percolation_timeline_snapshots.sql"
run_sql "./db/ticker_metric_series_reliability.sql"

run_sql "./db/fred_macro_series_observations.sql"

run_sql "./db/sec_submissions_raw.sql"
run_sql "./db/sec_frames_raw.sql"

run_sql "./db/model_versions.sql"
run_sql "./db/scenario_definitions.sql"
run_sql "./db/scenario_factor_shocks.sql"

echo "✅ schema init done"
