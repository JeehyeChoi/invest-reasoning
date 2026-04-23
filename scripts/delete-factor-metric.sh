#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/delete-factor-metric.sh <factor> <metric_key>"
  echo
  echo "Examples:"
  echo "  ./scripts/delete-factor-metric.sh growth net_income"
  echo "  ./scripts/delete-factor-metric.sh quality roic"
  exit 1
fi

CONFIG_DIR="src/backend/config/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
SERVICE_DIR="src/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
WORKFLOW_DIR="src/backend/workflows/ticker-factor-snapshot/steps/${FACTOR}/fundamentals_based/${METRIC_KEY}"
CHECKLIST_FILE="tmp/${FACTOR}-${METRIC_KEY}-checklist.md"

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
echo "metric_key = $METRIC_KEY"

echo
echo "========================================"
echo "DELETE PREVIEW"
echo "========================================"
print_status "$CONFIG_DIR"
print_status "$SERVICE_DIR"
print_status "$WORKFLOW_DIR"
print_status "$CHECKLIST_FILE"

echo
echo "----------------------------------------"
echo "Item count"
echo "----------------------------------------"
echo "CONFIG    : $(count_items "$CONFIG_DIR")"
echo "SERVICE   : $(count_items "$SERVICE_DIR")"
echo "WORKFLOW  : $(count_items "$WORKFLOW_DIR")"
echo "CHECKLIST : $(count_items "$CHECKLIST_FILE")"
echo "----------------------------------------"

echo
echo "This will delete only the metric-level scaffold paths above."
echo "It will NOT remove manual registrations from:"
echo "  - src/backend/schemas/sec/metrics.ts"
echo "  - src/backend/services/sec/companyFacts/series/tagMeta.ts"
echo "  - src/backend/schemas/factor.ts"
echo "  - src/backend/schemas/factors/${FACTOR}.ts"
echo "  - src/backend/config/factors/blueprints.ts"
echo "  - src/backend/config/factors/active.ts"
echo "  - src/backend/workflows/ticker-factor-snapshot/runTickerFactorSnapshotsWorkflow.ts"

echo
read -p "Are you sure you want to delete these? (y/N): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo
echo "Deleting..."
delete_if_exists "$CONFIG_DIR"
delete_if_exists "$SERVICE_DIR"
delete_if_exists "$WORKFLOW_DIR"
delete_if_exists "$CHECKLIST_FILE"

echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Deleted metric scaffold for:"
echo "  factor     = $FACTOR"
echo "  metric_key = $METRIC_KEY"

echo
echo "Reminder:"
echo "- This script only removes scaffolded metric directories/files."
echo "- Clean up manual registrations separately if already added."
