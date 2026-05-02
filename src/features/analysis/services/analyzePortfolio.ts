import type { PortfolioAnalysisRequest } from "@/shared/analysis/portfolioAnalysisContract";

export type AnalyzePortfolioResponse = {
  result: unknown;
  debug?: {
    trace?: unknown;
    artifacts?: unknown;
  };
};

export async function analyzePortfolio(
  payload: PortfolioAnalysisRequest,
): Promise<AnalyzePortfolioResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to analyze portfolio.");
  }

  return data;
}
