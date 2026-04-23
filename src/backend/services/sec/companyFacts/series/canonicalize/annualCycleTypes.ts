import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";

export type AnnualCycleAnchors = {
  directQuarterlies: BuiltTagSeriesRow[];
  cumulative6m: BuiltTagSeriesRow | null;
  cumulative9m: BuiltTagSeriesRow | null;
  trailing6m: BuiltTagSeriesRow | null;
};

export type BuildAnnualCycleRowsInput = {
  annualRow: BuiltTagSeriesRow;
  directQuarterlies: BuiltTagSeriesRow[];
  cumulative6m: BuiltTagSeriesRow | null;
  cumulative9m: BuiltTagSeriesRow | null;
  trailing6m: BuiltTagSeriesRow | null;
  input: BuildTagSeriesInput;
};
