#!/usr/bin/env bash
set -euo pipefail

FACTOR="${1:-}"
METRIC_KEY="${2:-}"

if [ -z "$FACTOR" ] || [ -z "$METRIC_KEY" ]; then
  echo "Usage: ./scripts/create-factor-metric-upsert.sh <factor> <metric_key>"
  exit 1
fi

BASE_PATH="src/backend/services/factors/${FACTOR}/fundamentals_based/${METRIC_KEY}"
UPSERT_PATH="${BASE_PATH}/upsert.ts"

mkdir -p "$BASE_PATH"

if [ ! -f "$UPSERT_PATH" ] || ! grep -q "upsertMetric" "$UPSERT_PATH"; then
  cat > "$UPSERT_PATH" <<EOF
import type { FactorModelFamily } from "@/backend/config/factors/active";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import { upsertMetric } from "@/backend/services/factors/${FACTOR}/fundamentals_based/upsertMetric";

type UpsertInput = {
  ticker: string;
  cik: string | null;
  effectiveDate: string | null;
  metrics: GrowthMetricSignalsExtended;
  sourcePointCount: number;
  sourceWindowEnd: string | null;
  model: FactorModelFamily;
};

export async function upsert(input: UpsertInput): Promise<void> {
  return upsertMetric({
    ...input,
    factor: "${FACTOR}",
    axis: "fundamentals_based",
    metricKey: "${METRIC_KEY}",
  });
}
EOF

  echo "write: $UPSERT_PATH (created or replaced empty file)"
else
  echo "ok: upsert.ts already implemented"
fi
