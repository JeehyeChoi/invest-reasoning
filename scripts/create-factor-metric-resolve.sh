#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/create-factor-metric-resolve.sh <factor> <metric_key>"
  exit 1
fi

BASE_PATH="src/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
RESOLVE_PATH="${BASE_PATH}/resolve.ts"

TYPE_NAME="$(echo "$METRIC_KEY" | awk -F_ '{
  for (i=1; i<=NF; i++) {
    $i=toupper(substr($i,1,1)) substr($i,2)
  }
  print $0
}' OFS="")"

mkdir -p "$BASE_PATH"

if [ ! -f "$RESOLVE_PATH" ] || ! grep -q "resolveFlowMetricSeries" "$RESOLVE_PATH"; then
  cat > "$RESOLVE_PATH" <<EOF
import {
  resolveFlowMetricSeries,
  type FlowMetricSeriesPoint,
} from "@/backend/services/factors/${FACTOR}/fundamentals_based/resolveFlowMetricSeries";

export type ${TYPE_NAME}SeriesPoint = FlowMetricSeriesPoint;

type Resolve${TYPE_NAME}SeriesInput = {
  cik: string;
};

export async function resolve({
  cik,
}: Resolve${TYPE_NAME}SeriesInput): Promise<${TYPE_NAME}SeriesPoint[]> {
  return resolveFlowMetricSeries({
    cik,
    metricKey: "${METRIC_KEY}",
  });
}
EOF

  echo "write: $RESOLVE_PATH (created or replaced empty file)"
else
  echo "ok: resolve.ts already implemented"
fi
