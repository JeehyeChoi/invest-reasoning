import { requestFredSeriesObservations } from "@/backend/clients/fred";
import type { FredMacroSeriesDefinition } from "@/backend/services/macro/fred/types";

export type FredSeriesObservation = {
  seriesId: string;
  observationDate: string;
  value: number | null;
  units: string;
  frequency: string;
  realtimeStart: string | null;
  realtimeEnd: string | null;
};

type GetFredSeriesObservationsInput = {
  definition: FredMacroSeriesDefinition;
  observationStart?: string;
  observationEnd?: string;
};

export async function getFredSeriesObservations({
  definition,
  observationStart,
  observationEnd,
}: GetFredSeriesObservationsInput): Promise<FredSeriesObservation[]> {
  const observations = await requestFredSeriesObservations({
    seriesId: definition.seriesId,
    units: definition.units,
    observationStart,
    observationEnd,
  });

  return observations.map((observation) => ({
    seriesId: definition.seriesId,
    observationDate: observation.date,
    value: parseFredObservationValue(observation.value),
    units: definition.units,
    frequency: definition.frequency,
    realtimeStart: observation.realtime_start ?? null,
    realtimeEnd: observation.realtime_end ?? null,
  }));
}

function parseFredObservationValue(value: string): number | null {
  if (value === ".") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
