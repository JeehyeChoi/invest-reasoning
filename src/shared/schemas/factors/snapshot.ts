// shared/schemas/factors/snapshot.ts

export type FactorAxisKey =
  | "fundamentals_based"
  | "etf_implied"
  | "narrative_implied";

export type FactorAxisScore = {
  score: number | null;
  confidence: number | null;
  reason: string | null;
};

export type FactorScoreByAxis = {
  fundamentals_based: FactorAxisScore;
  etf_implied: FactorAxisScore;
  narrative_implied: FactorAxisScore;
};

export type TickerFactorSnapshot = {
  ticker: string;
  asOfDate: string;

  factors: {
    growth: FactorScoreByAxis;
    value: FactorScoreByAxis;
    quality: FactorScoreByAxis;
    momentum: FactorScoreByAxis;
  };
};
