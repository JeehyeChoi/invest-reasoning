import type { PortfolioAnalysisWorkflowInput } from "@/shared/types/workflow";
import type { CalculatedPortfolioItem } from "@/features/portfolio/utils/calculatePortfolio";
import type { TickerFactorSnapshot } from "@/shared/schemas/factors/snapshot";

export type ResolvedTickerMetadata = {
  profile: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
  marketData: Record<string, unknown> | null;
  tags: Array<{
    tag: string;
    source_rule: string | null;
    inferred_at?: string;
  }>;
  source: "database" | "provider";
};

export type MetadataArtifact = {
  byTicker: Record<string, ResolvedTickerMetadata | null>;
  fetchedAt: string;
};

export type ExposureSummary = {
  bySector: Record<string, number>;
  byIndustry: Record<string, number>;
  byTag: Record<string, number>;
  byCountry: Record<string, number>;
};

export type ExposureArtifact = {
  enrichedPortfolio: EnrichedPortfolioItem[];
  currentExposure: ExposureSummary;
  targetExposure: ExposureSummary;
  computedAt: string;
};

export type EnrichedPortfolioItem = CalculatedPortfolioItem & {
  sector: string | null;
  industry: string | null;
  country: string | null;
  tags: string[];
};


export type AnalysisPlanArtifact = {
  strategy?: string;
  notes?: string[];
};

export type FinalReportArtifact = {
  summary?: string;
};

export interface PortfolioAnalysisWorkflowContext {
  input: PortfolioAnalysisWorkflowInput;
  artifacts: {
    metadata?: MetadataArtifact;
    exposure?: ExposureArtifact;
    plan?: AnalysisPlanArtifact;
    report?: FinalReportArtifact;
  };
  trace: WorkflowTraceEntry[];
}

export type PortfolioAnalysisStepName =
  | "resolve_metadata"
  | "compute_exposure"
  | "generate_plan";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface WorkflowTraceEntry {
  step: PortfolioAnalysisStepName;
  status: WorkflowStepStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PortfolioAnalysisWorkflowStep {
  name: PortfolioAnalysisStepName;
  run(
    context: PortfolioAnalysisWorkflowContext,
  ): Promise<PortfolioAnalysisWorkflowContext>;
}

