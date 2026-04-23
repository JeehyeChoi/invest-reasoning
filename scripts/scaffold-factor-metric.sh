#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/scaffold-factor-metric.sh <factor> <metric_key>"
  echo
  echo "Examples:"
  echo "  ./scripts/scaffold-factor-metric.sh growth net_income"
  echo "  ./scripts/scaffold-factor-metric.sh quality roic"
  exit 1
fi

CONFIG_ROOT="src/backend/config/factors/${FACTOR}"
SERVICE_ROOT="src/backend/services/factors/${FACTOR}"
WORKFLOW_ROOT="src/backend/workflows/ticker-factor-snapshot/steps/${FACTOR}"

SOURCE_TYPES=(
  "fundamentals_based"
  "etf_implied"
  "narrative_implied"
)

METRIC_CONFIG_DIR="${CONFIG_ROOT}/fundamentals_based/${METRIC_KEY}"
METRIC_SERVICE_DIR="${SERVICE_ROOT}/fundamentals_based/${METRIC_KEY}"
METRIC_WORKFLOW_DIR="${WORKFLOW_ROOT}/fundamentals_based/${METRIC_KEY}"

create_dir() {
  local path="$1"
  mkdir -p "$path"
  echo "dir:    $path"
}

create_file_if_missing() {
  local path="$1"

  if [ -f "$path" ]; then
    echo "exists: $path"
  else
    touch "$path"
    echo "file:   $path"
  fi
}

echo
echo "Scaffolding factor/metric..."
echo "  factor     = $FACTOR"
echo "  metric_key = $METRIC_KEY"
echo

# Always create all 3 source-type axes for the factor
for TYPE in "${SOURCE_TYPES[@]}"; do
  create_dir "${CONFIG_ROOT}/${TYPE}"
  create_dir "${SERVICE_ROOT}/${TYPE}"
  create_dir "${WORKFLOW_ROOT}/${TYPE}"
done

echo
echo "Creating fundamentals_based metric scaffold..."
echo

create_dir "$METRIC_CONFIG_DIR"
create_dir "$METRIC_SERVICE_DIR"
create_dir "$METRIC_WORKFLOW_DIR"

create_file_if_missing "${METRIC_CONFIG_DIR}/display.json"
create_file_if_missing "${METRIC_CONFIG_DIR}/heuristic.json"

create_file_if_missing "${METRIC_SERVICE_DIR}/resolve.ts"
create_file_if_missing "${METRIC_SERVICE_DIR}/compute.ts"
create_file_if_missing "${METRIC_SERVICE_DIR}/upsert.ts"
create_file_if_missing "${METRIC_SERVICE_DIR}/interpret.ts"

sh ./scripts/create-workflow-step-run.sh "$FACTOR" "$METRIC_KEY"


echo
echo "Creating checklist..."
sh ./scripts/create-factor-metric-checklist.sh "$FACTOR" "$METRIC_KEY"

echo
echo "========================================"
echo "DONE"
echo "========================================"
echo "Created factor axes:"
for TYPE in "${SOURCE_TYPES[@]}"; do
  echo "  - src/backend/config/factors/${FACTOR}/${TYPE}"
  echo "  - src/backend/services/factors/${FACTOR}/${TYPE}"
  echo "  - src/backend/workflows/ticker-factor-snapshot/steps/${FACTOR}/${TYPE}"
done

echo
echo "Created fundamentals_based metric scaffold:"
echo "  - ${METRIC_CONFIG_DIR}"
echo "  - ${METRIC_SERVICE_DIR}"
echo "  - ${METRIC_WORKFLOW_DIR}"

echo
echo "Next:"
echo "  1) Fill display.json and heuristic.json using revenue as reference"
echo "  2) Implement service files"
echo "  3) Register schema/config/workflow points"


