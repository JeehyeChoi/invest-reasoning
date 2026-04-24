#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/create-factor-metric-compute.sh <factor> <metric_key>"
  exit 1
fi

BASE_PATH="src/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
COMPUTE_PATH="${BASE_PATH}/compute.ts"

TYPE_NAME="$(echo "$METRIC_KEY" | awk -F_ '{
  for (i=1; i<=NF; i++) {
    $i=toupper(substr($i,1,1)) substr($i,2)
  }
  print $0
}' OFS="")"

mkdir -p "$BASE_PATH"

if [ ! -f "$COMPUTE_PATH" ] || ! grep -q "computeSeriesGrowth" "$COMPUTE_PATH"; then
  cat > "$COMPUTE_PATH" <<EOF
import {
  computeSeriesGrowth,
  type SeriesGrowthConfig,
  type SeriesPoint,
} from "@/backend/services/factors/${FACTOR}/fundamentals_based/computeSeriesGrowth";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

export type ${TYPE_NAME}GrowthConfig = SeriesGrowthConfig;
export type ${TYPE_NAME}Point = SeriesPoint;

export function compute(
  series: ${TYPE_NAME}Point[],
  config: ${TYPE_NAME}GrowthConfig,
): GrowthMetricSignalsExtended | null {
  const mode = config.compute?.mode ?? "basic";

  return computeSeriesGrowth(series, config, mode) as
    | GrowthMetricSignalsExtended
    | null;
}
EOF

  echo "write: $COMPUTE_PATH (created or replaced empty file)"
else
  echo "ok: compute.ts already implemented"
fi
