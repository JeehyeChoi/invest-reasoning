import { db } from "@/backend/config/db";
import { getFredMacroSeriesDefinitions } from "@/backend/services/macro/fred/macroFredSeriesRegistry";
import type {
  FredMacroSeriesObservation,
  FredMacroSeriesOverview,
  FredMacroSeriesSummary,
} from "@/shared/macro/fred";

type FredMacroObservationRow = {
  series_id: string;
  observation_date: string | Date;
  value: number | string | null;
  fetched_at: string | Date | null;
  observation_count: number | string;
};

export async function getFredMacroSeriesOverview(): Promise<FredMacroSeriesOverview> {
  const definitions = getFredMacroSeriesDefinitions();
  const seriesIds = definitions.map((definition) => definition.seriesId);

  if (seriesIds.length === 0) {
    return {
      source: "fred",
      series: [],
      generatedAt: new Date().toISOString(),
      unavailableReason: "No FRED macro series definitions are registered.",
    };
  }

  const result = await db.query<FredMacroObservationRow>(
    `
    SELECT
      series_id,
      observation_date,
      value,
      fetched_at,
      count(*) OVER (PARTITION BY series_id) AS observation_count
    FROM public.fred_macro_series_observations
    WHERE series_id = ANY($1::text[])
      AND units = 'pc1'
    ORDER BY series_id ASC, observation_date ASC
    `,
    [seriesIds],
  );

  const rowsBySeriesId = new Map<string, FredMacroObservationRow[]>();

  for (const row of result.rows) {
    const rows = rowsBySeriesId.get(row.series_id) ?? [];
    rows.push(row);
    rowsBySeriesId.set(row.series_id, rows);
  }

  const series = definitions.map<FredMacroSeriesSummary>((definition) => {
    const rows = rowsBySeriesId.get(definition.seriesId) ?? [];
    const observations = rows.map<FredMacroSeriesObservation>((row) => ({
      observationDate: formatDateOnly(row.observation_date),
      value: formatNullableNumber(row.value),
    }));
    const validObservations = observations.filter(
      (observation) => observation.value !== null,
    );
    const latest = validObservations.at(-1) ?? observations.at(-1) ?? null;
    const previous =
      validObservations.length >= 2
        ? validObservations.at(-2) ?? null
        : observations.length >= 2
          ? observations.at(-2) ?? null
          : null;
    const latestRow = rows.at(-1);
    const observationCount = latestRow
      ? Number(latestRow.observation_count)
      : 0;

    return {
      key: definition.key,
      seriesId: definition.seriesId,
      units: definition.units,
      frequency: definition.frequency,
      label: definition.label,
      description: definition.description,
      latestObservationDate: latest?.observationDate ?? null,
      latestValue: latest?.value ?? null,
      previousObservationDate: previous?.observationDate ?? null,
      previousValue: previous?.value ?? null,
      observationCount,
      fetchedAt: latestRow?.fetched_at ? formatTimestamp(latestRow.fetched_at) : null,
      observations,
    };
  });

  const hasObservations = series.some((item) => item.observationCount > 0);

  return {
    source: "fred",
    series,
    generatedAt: new Date().toISOString(),
    unavailableReason: hasObservations
      ? undefined
      : "No stored FRED observations were found. Run the macro FRED sync job to populate this page.",
  };
}

function formatNullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function formatTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
