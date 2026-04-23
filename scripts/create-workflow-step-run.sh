#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/create-factor-metric-run.sh <factor> <metric_key>"
  exit 1
fi

BASE_PATH="src/backend/workflows/ticker-factor-snapshot/steps/${FACTOR}/fundamentals_based/${METRIC_KEY}"
RUN_PATH="${BASE_PATH}/run.ts"

mkdir -p "$BASE_PATH"

if [ ! -f "$RUN_PATH" ] || ! grep -q "buildMetricRunner" "$RUN_PATH"; then
  cat > "$RUN_PATH" <<EOF
import { resolve } from "@/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}/resolve";
import { compute } from "@/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}/compute";
import { upsert } from "@/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}/upsert";
import { buildMetricRunner } from "@/backend/workflows/ticker-factor-snapshot/steps/buildMetricRunner";

export const run = buildMetricRunner({
  factor: "${FACTOR}",
  axis: "fundamentals_based",
  metricKey: "${METRIC_KEY}",
  logPrefix: "${METRIC_KEY}.run",
  resolve,
  compute,
  upsert,
  getSeriesEnd: (point) => point.end ?? null,
});
EOF

  echo "write: $RUN_PATH (created or replaced empty file)"
else
  echo "ok: run.ts already implemented"
fi
