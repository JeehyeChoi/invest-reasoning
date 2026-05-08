#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
AXIS_OR_METRIC="${2:-}"
METRIC_OR_TICKER="${3:-}"
VERIFY_TICKER_ARG="${4:-}"

case "$AXIS_OR_METRIC" in
  fundamentals_based|market_price|valuation|macro_linked|etf_exposure|narrative_implied)
    AXIS="$AXIS_OR_METRIC"
    METRIC_KEY="$METRIC_OR_TICKER"
    VERIFY_TICKER="${VERIFY_TICKER_ARG:-MSFT}"
    ;;
  *)
    AXIS="fundamentals_based"
    METRIC_KEY="$AXIS_OR_METRIC"
    VERIFY_TICKER="${METRIC_OR_TICKER:-MSFT}"
    ;;
esac

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/factors/create-factor-metric-checklist.sh <factor> [axis] <metric_key> [verify_ticker]"
  echo "Examples:"
  echo "  ./scripts/factors/create-factor-metric-checklist.sh growth revenue"
  echo "  ./scripts/factors/create-factor-metric-checklist.sh momentum market_price price"
  exit 1
fi

OUT_DIR="tmp"
OUT_FILE="${OUT_DIR}/${FACTOR}-${AXIS}-${METRIC_KEY}-checklist.md"

mkdir -p "$OUT_DIR"

# Load local database env if present. AI_RULES.md allows only this env file.
if [ -f ".env.local.psql" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local.psql
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

mark_ts_object_key() {
  local file="$1"
  local key="$2"

  if [ -f "$file" ] && grep -Eq "^[[:space:]]*${key}:" "$file"; then
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

mark_feature_and_signal_outputs_exist() {
  local ticker="$1"
  local factor="$2"
  local axis="$3"
  local metric_key="$4"

  local query="
    WITH requested AS (
      SELECT '${ticker}'::text AS ticker,
             '${factor}'::text AS factor,
             '${axis}'::text AS axis,
             '${metric_key}'::text AS metric_key
    )
    SELECT
      (SELECT COUNT(*)
       FROM public.ticker_factor_metric_features s, requested r
       WHERE s.ticker = r.ticker
         AND s.factor = r.factor
         AND s.axis = r.axis
         AND s.metric_key = r.metric_key) AS features,
      (SELECT COUNT(*)
       FROM public.ticker_factor_signals fs, requested r
       WHERE fs.ticker = r.ticker
         AND fs.factor = r.factor
         AND fs.axis = r.axis) AS factor_signals,
      (SELECT COUNT(*)
       FROM public.ticker_factor_signals fs, requested r
       WHERE fs.ticker = r.ticker
         AND fs.factor = r.factor
         AND fs.axis = r.axis
         AND jsonb_array_length(fs.supporting_evidence) > 0) AS signal_evidence_rows;
  "

  local result=""

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[ ]"
    return
  fi

  if [ -n "${TIMEOUT_BIN:-}" ]; then
    result=$(
      "$TIMEOUT_BIN" 5 psql \
        "$DATABASE_URL" \
        -t -A \
        -c "$query" 2>/dev/null
    ) || true
  else
    result=$(
      psql \
        "$DATABASE_URL" \
        -t -A \
        -c "$query" 2>/dev/null
    ) || true
  fi

  result="$(echo "$result" | tr -d '[:space:]')"

  if echo "$result" | grep -Eq '^[1-9][0-9]*\|[1-9][0-9]*\|[1-9][0-9]*$'; then
    echo "[v]"
  else
    echo "[ ]"
  fi
}

mark_metric_reliability_outputs_exist() {
  local ticker="$1"
  local metric_key="$2"

  local query="
    SELECT COUNT(*)
    FROM public.ticker_metric_series_reliability
    WHERE ticker = '${ticker}'
      AND metric_key = '${metric_key}';
  "

  local result=""

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[ ]"
    return
  fi

  if [ -n "${TIMEOUT_BIN:-}" ]; then
    result=$(
      "$TIMEOUT_BIN" 5 psql \
        "$DATABASE_URL" \
        -t -A \
        -c "$query" 2>/dev/null
    ) || true
  else
    result=$(
      psql \
        "$DATABASE_URL" \
        -t -A \
        -c "$query" 2>/dev/null
    ) || true
  fi

  result="$(echo "$result" | tr -d '[:space:]')"

  if echo "$result" | grep -Eq '^[1-9][0-9]*$'; then
    echo "[v]"
  else
    echo "[ ]"
  fi
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

mark_feature_definition_owned() {
  local factor="$1"
  local axis="$2"
  local metric_key="$3"

  if node scripts/factors/check-feature-definition-ownership.mjs "$factor" "$axis" "$metric_key" >/dev/null 2>&1; then
    echo "[v]"
  else
    echo "[ ]"
  fi
}

CONFIG_DIR="src/backend/config/factors/${FACTOR}/${AXIS}/${METRIC_KEY}"

SCAFFOLD_CONFIG_MARK=$(mark_dir_exists "$CONFIG_DIR")

if [ "$AXIS" = "fundamentals_based" ]; then
  METRIC_REGISTRY_MARK=$(mark_required_grep \
    "src/shared/sec/metrics.ts" \
    "\"${METRIC_KEY}\""
  )

  BACKEND_METRIC_DEFINITION_MARK=$(mark_ts_object_key \
    "src/backend/config/sec/metrics.ts" \
    "$METRIC_KEY"
  )

  API_MARK=$(mark_api_series_ok "$VERIFY_TICKER" "$METRIC_KEY")
  METRIC_RELIABILITY_OUTPUTS_MARK=$(mark_metric_reliability_outputs_exist \
    "$VERIFY_TICKER" \
    "$METRIC_KEY"
  )
else
  METRIC_REGISTRY_MARK=$(mark_required_grep \
    "src/shared/market/priceMetrics.ts" \
    "\"${METRIC_KEY}\""
  )

  BACKEND_METRIC_DEFINITION_MARK="[n/a]"
  API_MARK="[n/a]"
  METRIC_RELIABILITY_OUTPUTS_MARK="[n/a]"
fi

FACTOR_KEY_MARK=$(mark_required_grep \
  "src/shared/factors/factors.ts" \
  "\"${FACTOR}\""
)

BLUEPRINTS_MARK=$(mark_blueprint_registered \
  "src/backend/config/factors/blueprints.ts" \
  "$FACTOR" \
  "$AXIS" \
  "$METRIC_KEY"
)

FEATURE_DEFINITION_OWNERSHIP_MARK=$(mark_feature_definition_owned \
  "$FACTOR" \
  "$AXIS" \
  "$METRIC_KEY"
)

FEATURE_AND_SIGNAL_OUTPUTS_MARK=$(mark_feature_and_signal_outputs_exist \
  "$VERIFY_TICKER" \
  "$FACTOR" \
  "$AXIS" \
  "$METRIC_KEY"
)

FEATURE_AND_SIGNAL_OUTPUTS_NOTE=""
if [ "$FEATURE_AND_SIGNAL_OUTPUTS_MARK" != "[v]" ]; then
  FEATURE_AND_SIGNAL_OUTPUTS_NOTE="- Feature/signal output check is unchecked. Run the ticker factor metric features job after the metric is registered and source series are available, then regenerate this checklist."
fi

METRIC_RELIABILITY_OUTPUTS_NOTE=""
if [ "$AXIS" = "fundamentals_based" ] && [ "$METRIC_RELIABILITY_OUTPUTS_MARK" != "[v]" ]; then
  METRIC_RELIABILITY_OUTPUTS_NOTE="- Metric reliability output check is unchecked. Run the metric_series job so ticker_metric_series_reliability is rebuilt after enriched metric series, then regenerate this checklist."
fi

cat > "$OUT_FILE" <<EOF
# Checklist for ${FACTOR}/${AXIS}/${METRIC_KEY}

## Scaffold
- ${SCAFFOLD_CONFIG_MARK} ${CONFIG_DIR}

## Shared/backend type checks
- ${METRIC_REGISTRY_MARK} shared metric registry includes ${METRIC_KEY}
- ${BACKEND_METRIC_DEFINITION_MARK} backend SEC metric definition exists for ${METRIC_KEY} (fundamentals_based only)
- ${FACTOR_KEY_MARK} src/shared/factors/factors.ts

## Registry checks (critical)
- ${BLUEPRINTS_MARK} blueprint includes ${FACTOR}/${AXIS}/${METRIC_KEY}
- ${FEATURE_DEFINITION_OWNERSHIP_MARK} ${CONFIG_DIR}/interpretation.json feature definitions are not reused by another factor

## Verification (manual/runtime)
- ${API_MARK} source metric API returns series for ${METRIC_KEY} (ticker=${VERIFY_TICKER}; fundamentals_based only)
- ${METRIC_RELIABILITY_OUTPUTS_MARK} metric series reliability records exist for ${METRIC_KEY} (ticker=${VERIFY_TICKER}; fundamentals_based only)
- ${FEATURE_AND_SIGNAL_OUTPUTS_MARK} metric feature and factor signal outputs exist for ${METRIC_KEY} (ticker=${VERIFY_TICKER})

## AI review
- [review] ${CONFIG_DIR}/display.json is filled if empty, then labels, chart title, and description match the metric and factor context.
- [review] ${CONFIG_DIR}/interpretation.json is filled if empty, then feature mapping from enriched source columns is coherent.
- [review] ${CONFIG_DIR}/interpretation.json follows the standard top-level schema: version, factor, axis, metricKey, meta, and features; each feature key is the persisted feature_key.
- [review] Every feature in ${CONFIG_DIR}/interpretation.json defines its own series metadata (table, version, metricKey, periodType); do not rely on a top-level source default.
- [review] ${CONFIG_DIR}/interpretation.json lists only active feature definitions; remove inactive candidates instead of keeping boolean enablement flags.
- [review] Each ${CONFIG_DIR}/interpretation.json feature explicitly defines method, valueType, comparison, macroContrast, and clustering; omit reference only when the method does not need a comparison source.
- [review] valueType is ratio for peer-comparable ratios/normalized features and value for raw amount features; comparison=true is reserved for the benchmark comparison layer.
- [review] macroContrast=true is used only when the feature can be compared to an external macro ratio such as FRED YoY series.
- [review] Every source/reference/sources/denominator.source/counterpart.source column used by ${CONFIG_DIR}/interpretation.json exists in db/sec_companyfact_metric_series_enriched.sql and is produced by src/backend/services/sec/companyFacts/series/enriched/buildCompanyFactsMetricSeriesEnrichedForCik.ts; add enriched fields there first when a new feature method needs a new calculation basis.
- [review] Every source/reference/sources/denominator.source/counterpart.source column used by ${CONFIG_DIR}/interpretation.json produces non-null values for the metric's actual factType and periodType; column existence alone is not enough.
- [review] If a feature uses denominator or counterpart, that nested series metadata explicitly defines table, version, metricKey, periodType, and source; confirm the denominator/counterpart metric is registered and has enriched rows before accepting the feature.
- [review] If ${CONFIG_DIR}/interpretation.json uses any duration_adjusted_* source/reference, confirm src/backend/config/sec/metrics.ts sets ${METRIC_KEY} durationPolicy=duration_adjust_growth; reported_only and not_applicable metrics should use reported/point fields that are actually produced.
- [review] ${CONFIG_DIR}/interpretation.json may reuse the metric as an input, but each feature definition remains ${FACTOR}-owned unless it is an explicit shared concept such as turnaroundMomentum; do not accidentally reuse the same source/method/reference/lookback/sources feature definition from another factor.
- [review] src/backend/config/factors/blueprints.ts sets an explicit metricProfiles role for ${FACTOR}/${AXIS}/${METRIC_KEY}; use core for the factor's main evidence, supporting for secondary factor evidence, and context for cross-factor context metrics.
- [review] If ${METRIC_KEY} is newly introduced to the metric registry, src/backend/services/sec/companyFacts/series/tagMeta.ts defines every SEC source tag used to build it; raw SEC companyfacts do not store flow/instant semantics as a trusted column, so tagMeta.ts is the canonical manual mapping.
- [review] For every tagMeta.ts mapping for ${METRIC_KEY}, confirm the intended unit, fact type (flow, instant, per_share, or share_count), tag priority order, and whether the tag currently appears with sufficient coverage in raw/tag inventory for representative tickers.
- [review] If multiple SEC tags can represent ${METRIC_KEY}, document why the priority order is correct and whether any tag should be filtered by sector/industry-specific tag family instead of merged into a generic metric candidate pool.
- [review] Compare src/backend/services/sec/companyFacts/series/tagMeta.ts factType for ${METRIC_KEY} against ${CONFIG_DIR}/interpretation.json source.periodType before accepting the metric: tagMeta flow/per_share/share_count should normally feed periodType=quarter, while tagMeta instant should feed periodType=instant unless the metric is explicitly derived from another flow-based source.
- [review] If ${METRIC_KEY} is derived, confirm the interpretation periodType against the source input metrics' tagMeta.ts factTypes, not against the derived metric key itself.
- [review] If tagMeta.ts factType and ${CONFIG_DIR}/interpretation.json source.periodType differ, stop and either change interpretation.json to the correct period type or implement the missing enriched/feature semantics first; do not rely on empty feature output as an acceptable fallback.
- [review] If ${METRIC_KEY} is instant-based, confirm the metric build/enriched/feature path uses snapshot semantics (end-date pairing, QoQ/YoY level or growth comparisons as appropriate) and does not rely on flow-only duration, quarter reconstruction, or TTM-sum assumptions.
- [review] If ${METRIC_KEY} is flow-based, confirm the metric build path supports period resolution, annual/quarter/YTD handling, segment merging/reconstruction, and any duration-adjusted calculations required by src/backend/config/sec/metrics.ts durationPolicy.
- [review] src/backend/config/sec/metrics.ts classifies ${METRIC_KEY} correctly as canonical, internal, or derived, and the metric series build layer supports that classification.
- [review] Any shared contracts touched by ${FACTOR}/${METRIC_KEY} are updated deliberately, including src/shared/sec/metrics.ts, src/shared/factors/factors.ts, src/shared/tickers/*, and related schema files if new fields or keys cross the backend/frontend boundary.
- [review] If metric reliability keys or display semantics change, update src/shared/sec/metricSeriesReliability.ts so backend calculations, ticker detail payloads, and methodology/UI labels share the same definitions.
- [review] src/backend/services/sec/companyFacts/series/reliability/buildMetricSeriesReliabilityForCik.ts treats ${METRIC_KEY} reliability as metric-owned, not factor-owned.
- [review] src/backend/services/sec/companyFacts/series/signal/buildTickerFactorSignals.ts aggregates ${FACTOR}-owned metric features into ticker factor signals without compatibility redirection.
- [review] src/backend/services/sec/companyFacts/series/signal/buildTickerFactorSignals.ts covers the ${FACTOR}/${AXIS} signal selection path using ticker_factor_signal_definitions, including observed metric counts, confidence, and supporting evidence for the feature methods used by ${CONFIG_DIR}/interpretation.json.
- [review] If ${METRIC_KEY} introduces a new feature method, factor use case, denominator/counterpart dependency, or instant/snapshot interpretation, update factor signal definitions deliberately instead of relying on growth/flow defaults.
- [review] db/ticker_factor_signal_definitions.sql includes any new ${FACTOR} signal label, selection rule, evidence rule, and confidence rule needed by ${METRIC_KEY}; do not add prose commentary until the commentary layer is deliberately reintroduced.
- [review] If ${FACTOR}/${AXIS}/${METRIC_KEY} changes the feature set or downstream usage flags, rerun feature outputs and factor signals, then confirm stale feature keys are gone from features and signal evidence.

## Notes
- Config files are scaffold-checked by path, but display content and feature mapping should be filled/reviewed in the AI review step.
- Metrics can be reused across factors as source inputs; factor feature definitions should not be reused across factors unless the source/method/reference/lookback/sources concept is intentionally changed at the source or the feature key is an explicit shared concept such as turnaroundMomentum.
- Axis semantics matter: do not mix company funding liquidity with market trading liquidity, or fundamental exposure with market/macro reaction, unless the factor-axis definition explicitly says that is the evidence being measured.
- active.ts only resolves display config; factor metric calculation uses blueprint and interpretation config directly.
- API verification assumes the local app is running at http://localhost:3000.
- DB verification uses DATABASE_URL from .env.local.psql when present.
- Metric reliability records are rebuilt by the Metric series job after enriched metric series exists.
- For fundamentals_based metrics, run metric_series, sec_metric_series_enriched, factor_metric_features, and factor_signals. For market_price metrics, run ticker_daily_price_history_sync as needed, then market_price_factor_features and factor_signals. For valuation features, ensure both SEC metric series and price history are current, then run valuation_metric_series_enriched, factor_metric_features, and factor_signals.
- Factor metric features and factor signals each delete the current execution scope before re-inserting, so reruns should clear stale feature and evidence keys.
- Clustering reads feature or signal vectors after feature/signal jobs complete, but clustering is a later layer outside this checklist's core acceptance path.
- UI chart/headline rendering is the final browser verification step after config, registry, API, feature outputs, and factor signal outputs pass.
${FEATURE_AND_SIGNAL_OUTPUTS_NOTE}
${METRIC_RELIABILITY_OUTPUTS_NOTE}
EOF

echo "checklist: ${OUT_FILE}"
