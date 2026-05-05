import { db } from "@/backend/config/db";
import type { FredSeriesObservation } from "@/backend/services/macro/fred/getFredSeriesObservations";

export async function upsertFredMacroSeriesObservations(
  observations: FredSeriesObservation[],
): Promise<number> {
  if (observations.length === 0) {
    return 0;
  }

  const values: unknown[] = [];
  const placeholders = observations.map((observation, index) => {
    const offset = index * 7;

    values.push(
      observation.seriesId,
      observation.observationDate,
      observation.value,
      observation.units,
      observation.frequency,
      observation.realtimeStart,
      observation.realtimeEnd,
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
  });

  await db.query(
    `
    INSERT INTO public.fred_macro_series_observations (
      series_id,
      observation_date,
      value,
      units,
      frequency,
      realtime_start,
      realtime_end
    )
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (series_id, units, observation_date)
    DO UPDATE SET
      value = EXCLUDED.value,
      frequency = EXCLUDED.frequency,
      realtime_start = EXCLUDED.realtime_start,
      realtime_end = EXCLUDED.realtime_end,
      fetched_at = now(),
      updated_at = now()
    `,
    values,
  );

  return observations.length;
}
