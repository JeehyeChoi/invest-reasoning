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
  echo "Usage: ./scripts/factors/delete-factor-metric.sh <factor> [axis] <metric_key>"
  echo
  echo "Examples:"
  echo "  ./scripts/factors/delete-factor-metric.sh growth net_income"
  echo "  ./scripts/factors/delete-factor-metric.sh momentum market_price price"
  exit 1
fi

CHECKLIST_FILE="tmp/${FACTOR}-${AXIS}-${METRIC_KEY}-checklist.md"
FEATURE_DEFINITION_FILE="db/ticker_factor_feature_definitions.sql"
METRIC_DISPLAY_DEFINITION_FILE="db/ticker_factor_metric_display_definitions.sql"
AXIS_DISPLAY_DEFINITION_FILE="db/ticker_factor_axis_display_definitions.sql"

print_status() {
  local path="$1"

  if [ -d "$path" ]; then
    echo "[DIR ] $path"
  elif [ -f "$path" ]; then
    echo "[FILE] $path"
  else
    echo "[MISS] $path"
  fi
}

count_items() {
  local path="$1"

  if [ -d "$path" ]; then
    find "$path" | wc -l | tr -d ' '
  elif [ -f "$path" ]; then
    echo "1"
  else
    echo "0"
  fi
}

delete_if_exists() {
  local path="$1"

  if [ -d "$path" ]; then
    rm -rf "$path"
    echo "deleted dir:  $path"
  elif [ -f "$path" ]; then
    rm -f "$path"
    echo "deleted file: $path"
  else
    echo "skip:         $path (not found)"
  fi
}

echo
echo "========================================"
echo "DELETE FACTOR METRIC"
echo "========================================"
echo "factor     = $FACTOR"
echo "axis       = $AXIS"
echo "metric_key = $METRIC_KEY"

echo
echo "========================================"
echo "DELETE PREVIEW"
echo "========================================"
print_status "$CHECKLIST_FILE"
print_status "$FEATURE_DEFINITION_FILE"
print_status "$METRIC_DISPLAY_DEFINITION_FILE"
print_status "$AXIS_DISPLAY_DEFINITION_FILE"

echo
echo "----------------------------------------"
echo "Item count"
echo "----------------------------------------"
echo "CHECKLIST : $(count_items "$CHECKLIST_FILE")"
echo "----------------------------------------"

echo
echo "This will delete only the generated checklist."
echo "It will NOT remove manual registrations from:"
echo "  - src/shared/sec/metrics.ts"
echo "  - src/backend/config/sec/metrics.ts"
echo "  - src/backend/services/sec/companyFacts/series/tagMeta.ts"
echo "  - src/backend/config/factors/blueprints.ts"
echo "  - db/ticker_factor_feature_definitions.sql"
echo "  - db/ticker_factor_metric_display_definitions.sql"
echo "  - db/ticker_factor_axis_display_definitions.sql"

echo
read -p "Are you sure you want to delete these? (y/N): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo
echo "Deleting..."
delete_if_exists "$CHECKLIST_FILE"

echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Deleted metric scaffold for:"
echo "  factor     = $FACTOR"
echo "  axis       = $AXIS"
echo "  metric_key = $METRIC_KEY"

echo
echo "Reminder:"
echo "- This script only removes the generated checklist."
echo "- Remove SQL definition rows and manual registrations separately if already added."
