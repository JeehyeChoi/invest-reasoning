#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"
VERIFY_TICKER="${3:-MSFT}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/create-factor-metric-checklist.sh <factor> <metric_key> [verify_ticker]"
  exit 1
fi

OUT_DIR="tmp"
OUT_FILE="${OUT_DIR}/${FACTOR}-${METRIC_KEY}-checklist.md"

mkdir -p "$OUT_DIR"

# Load .env.local if present
if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
fi

mark_required_grep() {
  local file="$1"
  local pattern="$2"

  if [ -f "$file" ] && grep -q "$pattern" "$file"; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

mark_required_fixed() {
  local file="$1"
  local text="$2"

  if [ -f "$file" ] && grep -Fq "$text" "$file"; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

mark_file_exists() {
  local file="$1"

  if [ -f "$file" ]; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

mark_dir_exists() {
  local dir="$1"

  if [ -d "$dir" ]; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

mark_optional_grep() {
  local file="$1"
  local pattern="$2"

  if [ -f "$file" ] && grep -q "$pattern" "$file"; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

mark_api_series_ok() {
  local ticker="$1"
  local metric_key="$2"

  local url="http://localhost:3000/api/tickers/${ticker}/series/${metric_key}"
  local response

  response=$(curl --max-time 5 -fsS "$url" 2>/dev/null || true)

  if echo "$response" | grep -Fq "\"metricKey\":\"${metric_key}\"" \
    && echo "$response" | grep -Fq "\"points\":["; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}
mark_db_row_exists() {
  local ticker="$1"
  local factor="$2"
  local axis="$3"
  local metric_key="$4"

  local query="
    SELECT COUNT(*)
    FROM ticker_factor_metrics
    WHERE ticker = '${ticker}'
      AND factor = '${factor}'
      AND axis = '${axis}'
      AND metric_key = '${metric_key}';
  "

  local result=""

  if [ -n "${TIMEOUT_BIN:-}" ]; then
    result=$(
      PGPASSWORD="${DB_PASSWORD:-}" \
      "$TIMEOUT_BIN" 5 psql \
        -U geo_master \
        -d geo_portfolio \
        -h localhost \
        -t -A \
        -c "$query" 2>/dev/null
    ) || true
  else
    result=$(
      PGPASSWORD="${DB_PASSWORD:-}" \
      psql \
        -U geo_master \
        -d geo_portfolio \
        -h localhost \
        -t -A \
        -c "$query" 2>/dev/null
    ) || true
  fi

  result="$(echo "$result" | tr -d '[:space:]')"

  if [ -n "$result" ] && [ "$result" != "0" ]; then
    echo "[x]"
  else
    echo "[ ]"
  fi
}

CONFIG_DIR="src/backend/config/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
SERVICE_DIR="src/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
WORKFLOW_DIR="src/backend/workflows/ticker-factor-snapshot/steps/${FACTOR}/fundamentals_based/${METRIC_KEY}"
RUN_PATH="${WORKFLOW_DIR}/run.ts"

SCAFFOLD_CONFIG_MARK=$(mark_dir_exists "$CONFIG_DIR")
SCAFFOLD_SERVICE_MARK=$(mark_dir_exists "$SERVICE_DIR")
SCAFFOLD_WORKFLOW_MARK=$(mark_dir_exists "$WORKFLOW_DIR")

DISPLAY_CONFIG_MARK=$(mark_required_grep \
  "${CONFIG_DIR}/display.json" \
  "\"metricKey\": \"${METRIC_KEY}\""
)

HEURISTIC_CONFIG_MARK=$(mark_required_grep \
  "${CONFIG_DIR}/heuristic.json" \
  "\"metricKey\": \"${METRIC_KEY}\""
)

SEC_METRICS_MARK=$(mark_required_grep \
  "src/backend/schemas/sec/metrics.ts" \
  "\"${METRIC_KEY}\""
)

TAG_META_MARK=$(mark_required_grep \
  "src/backend/services/sec/companyFacts/series/tagMeta.ts" \
  "metricKey: \"${METRIC_KEY}\""
)

FACTOR_SCHEMA_MARK=$(mark_file_exists "src/backend/schemas/factors/${FACTOR}.ts")

BLUEPRINTS_MARK=$(mark_required_grep \
  "src/backend/config/factors/blueprints.ts" \
  "\"${METRIC_KEY}\""
)

ACTIVE_MARK=$(mark_optional_grep \
  "src/backend/config/factors/active.ts" \
  "${FACTOR}:fundamentals_based:${METRIC_KEY}"
)

RUNNER_IMPL_MARK=$(mark_required_fixed \
  "$RUN_PATH" \
  "export const run = buildMetricRunner({"
)

STEP_RUNNER_MARK=$(mark_required_fixed \
  "src/backend/workflows/ticker-factor-snapshot/stepRunners.ts" \
  "${METRIC_KEY}:"
)

API_MARK=$(mark_api_series_ok "$VERIFY_TICKER" "$METRIC_KEY")

METRIC_DB_MARK=$(mark_db_row_exists \
  "$VERIFY_TICKER" \
  "$FACTOR" \
  "fundamentals_based" \
  "$METRIC_KEY"
)

cat > "$OUT_FILE" <<EOF
# Checklist for ${FACTOR}/${METRIC_KEY}

## Scaffold
- ${SCAFFOLD_CONFIG_MARK} ${CONFIG_DIR}
- ${SCAFFOLD_SERVICE_MARK} ${SERVICE_DIR}
- ${SCAFFOLD_WORKFLOW_MARK} ${WORKFLOW_DIR}

## Config files (auto-check + manual review)
- ${DISPLAY_CONFIG_MARK} ${CONFIG_DIR}/display.json
- ${HEURISTIC_CONFIG_MARK} ${CONFIG_DIR}/heuristic.json

## Registration checks (critical)
- ${SEC_METRICS_MARK} src/backend/schemas/sec/metrics.ts
- ${TAG_META_MARK} src/backend/services/sec/companyFacts/series/tagMeta.ts
- ${BLUEPRINTS_MARK} src/backend/config/factors/blueprints.ts

## Schema checks (contextual)
- ${FACTOR_SCHEMA_MARK} src/backend/schemas/factors/${FACTOR}.ts

## Optional / model-selection checks
- ${ACTIVE_MARK} src/backend/config/factors/active.ts (only if metric-specific model override is needed)

## Workflow registration
- ${STEP_RUNNER_MARK} step runner registered in src/backend/workflows/ticker-factor-snapshot/stepRunners.ts
- ${RUNNER_IMPL_MARK} runner implementation exists at ${RUN_PATH}

## Verification (manual/runtime)
- ${API_MARK} API returns series for ${METRIC_KEY} (ticker=${VERIFY_TICKER})
- ${METRIC_DB_MARK} ${METRIC_KEY} metrics computed and persisted (ticker=${VERIFY_TICKER})
- [ ] ticker UI renders chart / headline correctly for ${METRIC_KEY}

## Notes
- Config files are auto-checked by metricKey presence, but should still be manually reviewed for weights and display correctness.
- active.ts should be reviewed when introducing a new metric; update only if a metric-specific model override is required.
- API verification assumes the local app is running at http://localhost:3000.
- DB verification assumes local PostgreSQL access for:
  geo_master@localhost / geo_portfolio
EOF

echo "checklist: ${OUT_FILE}"
