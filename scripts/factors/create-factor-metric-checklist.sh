#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"
VERIFY_TICKER="${3:-MSFT}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/factors/create-factor-metric-checklist.sh <factor> <metric_key> [verify_ticker]"
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
    echo "[v]"
  else
    echo "[ ]"
  fi
}

mark_required_fixed() {
  local file="$1"
  local text="$2"

  if [ -f "$file" ] && grep -Fq "$text" "$file"; then
    echo "[v]"
  else
    echo "[ ]"
  fi
}

mark_file_exists() {
  local file="$1"

  if [ -f "$file" ]; then
    echo "[v]"
  else
    echo "[ ]"
  fi
}

mark_dir_exists() {
  local dir="$1"

  if [ -d "$dir" ]; then
    echo "[v]"
  else
    echo "[ ]"
  fi
}

mark_optional_grep() {
  local file="$1"
  local pattern="$2"

  if [ -f "$file" ] && grep -q "$pattern" "$file"; then
    echo "[v]"
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
    echo "[v]"
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
    echo "[v]"
  else
    echo "[ ]"
  fi
}

mark_required_all_fixed() {
  local file="$1"
  shift

  if [ ! -f "$file" ]; then
    echo "[ ]"
    return
  fi

  for pattern in "$@"; do
    if ! grep -qF "$pattern" "$file"; then
      echo "[ ]"
      return
    fi
  done

  echo "[v]"
}

mark_blueprint_registered() {
  local file="$1"
  local factor="$2"
  local axis="$3"
  local metric_key="$4"

  if node scripts/factors/check-blueprint-metric.mjs "$file" "$factor" "$axis" "$metric_key"; then
    echo "[v]"
  else
    echo "[ ]"
  fi
}

to_pascal_case() {
  echo "$1" | awk -F_ '{
    for (i=1; i<=NF; i++) {
      $i=toupper(substr($i,1,1)) substr($i,2)
    }
    printf "%s", $0
  }' OFS=""
}

CONFIG_DIR="src/backend/config/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"

SCAFFOLD_CONFIG_MARK=$(mark_dir_exists "$CONFIG_DIR")

DISPLAY_CONFIG_MARK=$(mark_required_grep \
  "${CONFIG_DIR}/display.json" \
  "\"metricKey\": \"${METRIC_KEY}\""
)

INTERPRETATION_CONFIG_MARK=$(mark_required_grep \
  "${CONFIG_DIR}/interpretation.json" \
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

BLUEPRINTS_MARK=$(mark_blueprint_registered \
  "src/backend/config/factors/blueprints.ts" \
  "$FACTOR" \
  "fundamentals_based" \
  "$METRIC_KEY"
)

ACTIVE_MARK=$(mark_optional_grep \
  "src/backend/config/factors/active.ts" \
  "${FACTOR}:fundamentals_based:${METRIC_KEY}"
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

## Config files (auto-check + manual review)
- ${DISPLAY_CONFIG_MARK} ${CONFIG_DIR}/display.json
- ${INTERPRETATION_CONFIG_MARK} ${CONFIG_DIR}/interpretation.json

## Registration checks (critical)
- ${SEC_METRICS_MARK} src/backend/schemas/sec/metrics.ts
- ${TAG_META_MARK} src/backend/services/sec/companyFacts/series/tagMeta.ts
- ${BLUEPRINTS_MARK} blueprint includes ${FACTOR}/fundamentals_based/${METRIC_KEY}

## Schema checks (contextual)
- ${FACTOR_SCHEMA_MARK} src/backend/schemas/factors/${FACTOR}.ts

## Optional / legacy method-selection checks
- ${ACTIVE_MARK} src/backend/config/factors/active.ts (legacy only; signal/baseline/ranking pipeline should not require a metric-specific method override)

## Signal pipeline checks
- [ ] interpretation.json maps enriched source columns to signal keys
- [ ] src/backend/config/factors/blueprints.ts includes ${FACTOR}/fundamentals_based/${METRIC_KEY}
- [ ] ticker_factor_metric_signals rows are created for ${METRIC_KEY}
- [ ] ticker_factor_metric_baselines and ticker_factor_metric_signal_positions include ${METRIC_KEY}

## Verification (manual/runtime)
- ${API_MARK} API returns series for ${METRIC_KEY} (ticker=${VERIFY_TICKER})
- ${METRIC_DB_MARK} ${METRIC_KEY} metrics computed and persisted (ticker=${VERIFY_TICKER})
- [ ] ticker UI renders chart / headline correctly for ${METRIC_KEY}

## Notes
- Config files are auto-checked by metricKey presence, but should still be manually reviewed for interpretation signals and display correctness.
- active.ts should be reviewed only if legacy method-based code is still being used for the metric.
- API verification assumes the local app is running at http://localhost:3000.
- DB verification assumes local PostgreSQL access for:
  geo_master@localhost / geo_portfolio
EOF

echo "checklist: ${OUT_FILE}"
