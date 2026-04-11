import type { LlmProvider, AnalysisStrategy } from "@/shared/types/analysis"
import type { PortfolioItemComputed } from "@/shared/types/portfolio"

export interface PortfolioAnalysisWorkflowInput {
  provider: LlmProvider
  strategy: AnalysisStrategy
  calculatedPortfolio: PortfolioItemComputed[]
}

