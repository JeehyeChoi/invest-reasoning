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

echo
echo "Scaffolding factor/metric..."
echo "  factor     = $FACTOR"
echo "  axis       = $AXIS"
echo "  metric_key = $METRIC_KEY"
echo

echo
echo "Preparing SQL definition checklist..."
echo

echo
echo "Creating checklist..."
bash ./scripts/factors/create-factor-metric-checklist.sh "$FACTOR" "$AXIS" "$METRIC_KEY"

echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Prepared ${AXIS} metric definition checklist for:"
echo "  factor     = ${FACTOR}"
echo "  axis       = ${AXIS}"
echo "  metric_key = ${METRIC_KEY}"

echo
echo "Next:"
echo "  1) Add feature rows to db/ticker_factor_feature_definitions.sql"
echo "  2) Add metric display rows to db/ticker_factor_metric_display_definitions.sql"
echo "  3) Add/update axis display rows in db/ticker_factor_axis_display_definitions.sql"
echo "  4) Add/update signal rows in db/ticker_factor_signal_definitions.sql"
echo "  5) Register shared metric keys, schema/config points, and blueprint membership"
echo "  6) Confirm the feature executor supports the definition method/source process"
echo "  7) Apply definition SQL, run the axis-specific source and feature jobs, then regenerate the checklist"
