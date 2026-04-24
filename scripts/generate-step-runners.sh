#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="src/backend/workflows/ticker-factor-snapshot/steps"
OUTPUT_FILE="src/backend/workflows/ticker-factor-snapshot/stepRunners.ts"

to_pascal_case() {
  echo "$1" | awk -F_ '{
    for (i=1; i<=NF; i++) {
      $i = toupper(substr($i,1,1)) substr($i,2)
    }
    printf "%s", $0
  }' OFS=""
}

IMPORT_LINES=""
MAP_BODY=""

while IFS= read -r run_path; do
  rel="${run_path#$BASE_DIR/}"

  factor="$(echo "$rel" | cut -d/ -f1)"
  axis="$(echo "$rel" | cut -d/ -f2)"
  metric_key="$(echo "$rel" | cut -d/ -f3)"

  factor_pascal="$(to_pascal_case "$factor")"
  axis_pascal="$(to_pascal_case "$axis")"
  metric_pascal="$(to_pascal_case "$metric_key")"

  alias="run${factor_pascal}${axis_pascal}${metric_pascal}"

  import_path="@/backend/workflows/ticker-factor-snapshot/steps/${factor}/${axis}/${metric_key}/run"

  IMPORT_LINES+="import { run as ${alias} } from \"${import_path}\";\n"
done < <(find "$BASE_DIR" -mindepth 4 -maxdepth 4 -type f -name "run.ts" | sort)

{
  printf "%b\n" "$IMPORT_LINES"
  printf "import type { StepRunnerMap } from \"./workflow.step.types\";\n\n"
  printf "export const STEP_RUNNERS: StepRunnerMap = {\n"

  current_factor=""
  current_axis=""

  while IFS= read -r run_path; do
    rel="${run_path#$BASE_DIR/}"

    factor="$(echo "$rel" | cut -d/ -f1)"
    axis="$(echo "$rel" | cut -d/ -f2)"
    metric_key="$(echo "$rel" | cut -d/ -f3)"

    alias="run$(to_pascal_case "$factor")$(to_pascal_case "$axis")$(to_pascal_case "$metric_key")"

    if [ "$factor" != "$current_factor" ]; then
      if [ -n "$current_axis" ]; then
        printf "    },\n"
        current_axis=""
      fi
      if [ -n "$current_factor" ]; then
        printf "  },\n"
      fi
      printf "  %s: {\n" "$factor"
      current_factor="$factor"
    fi

    if [ "$axis" != "$current_axis" ]; then
      if [ -n "$current_axis" ]; then
        printf "    },\n"
      fi
      printf "    %s: {\n" "$axis"
      current_axis="$axis"
    fi

    printf "      %s: %s,\n" "$metric_key" "$alias"
  done < <(find "$BASE_DIR" -mindepth 4 -maxdepth 4 -type f -name "run.ts" | sort)

  if [ -n "$current_axis" ]; then
    printf "    },\n"
  fi

  if [ -n "$current_factor" ]; then
    printf "  },\n"
  fi

  printf "};\n"
} > "$OUTPUT_FILE"

echo "Generated: $OUTPUT_FILE"
