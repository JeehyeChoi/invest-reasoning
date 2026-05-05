export type FredMacroSeriesObservation = {
  observationDate: string;
  value: number | null;
};

export type FredMacroSeriesSummary = {
  key: string;
  seriesId: string;
  units: string;
  frequency: string;
  label: string;
  description: string;
  latestObservationDate: string | null;
  latestValue: number | null;
  previousObservationDate: string | null;
  previousValue: number | null;
  observationCount: number;
  fetchedAt: string | null;
  observations: FredMacroSeriesObservation[];
};

export type FredMacroSeriesOverview = {
  source: "fred";
  series: FredMacroSeriesSummary[];
  generatedAt: string;
  unavailableReason?: string;
};
