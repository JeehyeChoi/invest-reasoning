#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
AXIS_OR_METRIC="${2:-}"
METRIC_OR_EMPTY="${3:-}"

case "$AXIS_OR_METRIC" in
  fundamentals_based|market_price|valuation|macro_linked|etf_exposure|narrative_implied)
    AXIS="$AXIS_OR_METRIC"
    METRIC_KEY="$METRIC_OR_EMPTY"
    ;;
  *)
    AXIS="fundamentals_based"
    METRIC_KEY="$AXIS_OR_METRIC"
    ;;
esac

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/factors/scaffold-factor-metric.sh <factor> [axis] <metric_key>"
  echo
  echo "Examples:"
  echo "  ./scripts/factors/scaffold-factor-metric.sh growth net_income"
  echo "  ./scripts/factors/scaffold-factor-metric.sh momentum market_price price"
  echo "  ./scripts/factors/scaffold-factor-metric.sh liquidity_sensitive accounts_receivable"
  exit 1
fi

CONFIG_ROOT="src/backend/config/factors/${FACTOR}"

METRIC_CONFIG_DIR="${CONFIG_ROOT}/${AXIS}/${METRIC_KEY}"

create_dir() {
  local path="$1"
  mkdir -p "$path"
  echo "dir:    $path"
}

create_file_if_missing() {
  local path="$1"
  local content="$2"

  if [ -f "$path" ]; then
    echo "exists: $path"
  else
    printf '%s\n' "$content" > "$path"
    echo "file:   $path"
  fi
}

echo
echo "Scaffolding factor/metric..."
echo "  factor     = $FACTOR"
echo "  axis       = $AXIS"
echo "  metric_key = $METRIC_KEY"
echo

echo
echo "Creating ${AXIS} metric scaffold..."
echo

create_dir "$METRIC_CONFIG_DIR"

create_file_if_missing "${METRIC_CONFIG_DIR}/display.json" "{
  \"metricKey\": \"${METRIC_KEY}\",
  \"chart\": {
    \"title\": \"TODO\"
  },
  \"description\": \"TODO\"
}"

create_file_if_missing "${METRIC_CONFIG_DIR}/interpretation.json" "{
  \"version\": \"interpretation_v1\",
  \"factor\": \"${FACTOR}\",
  \"axis\": \"${AXIS}\",
  \"metricKey\": \"${METRIC_KEY}\",
  \"meta\": {
    \"description\": \"TODO\",
    \"createdAt\": \"TODO\"
  },
  \"features\": {}
}"

echo
echo "Creating checklist..."
bash ./scripts/factors/create-factor-metric-checklist.sh "$FACTOR" "$AXIS" "$METRIC_KEY"

echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Created ${AXIS} metric scaffold:"
echo "  - ${METRIC_CONFIG_DIR}"

echo
echo "Next:"
echo "  1) Fill display.json and feature mapping config (interpretation.json)"
echo "  2) Give every feature method/valueType/comparison/macroContrast/clustering metadata"
echo "  3) Register schema/config points and blueprint membership"
echo "  4) Run the axis-specific source and feature jobs after source series exist, then regenerate the checklist"
