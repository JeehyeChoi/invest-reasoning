import type { PortfolioItemComputed } from "@/shared/types/portfolio"

type AnalysisStrategy = "papic" | "macro" | "valuation"

type BuildAnalysisPromptInput = {
  strategy: AnalysisStrategy
  portfolio: PortfolioItemComputed[]
}


function getStrategyInstruction(strategy: AnalysisStrategy): string {
  if (strategy === "papic") {
    return `
Use a geopolitical and constraint-based perspective.
Focus on macro constraints, regime shifts, geopolitical risk, energy, rates, and policy direction.
Do not treat markets as purely efficient.
Explain how constraints shape portfolio allocation.
`
  }

  if (strategy === "macro") {
    return `
Use a trend-following and macro-aware perspective.
Focus on momentum, sector leadership, market regime, rates, liquidity, and risk-on/risk-off dynamics.
Favor persistence of strong trends unless clear reversal signals exist.
`
  }

  return `
Use a valuation-based perspective.
Focus on relative valuation, overvaluation/undervaluation, earnings expectations, mean reversion, and margin of safety.
Discuss whether the portfolio is overweight expensive assets or underweight attractive assets.
`
}


function formatPortfolio(portfolio: PortfolioItemComputed[]): string {
  return portfolio
    .map((item) => {
      const label = item.ticker === "__CASH__" ? "CASH" : item.ticker

      return [
        `- Ticker: ${label}`,
        `  Current Weight: ${item.currentWeight?.toFixed(2) ?? "N/A"}%`,
        `  Target Weight: ${item.targetWeight?.toFixed(2) ?? "N/A"}%`,
        `  Current Value: ${item.currentValue?.toFixed(2) ?? "N/A"}`,
      ].join("\n")
    })
    .join("\n")
}

export function buildAnalysisPrompt({
  strategy,
  portfolio,
}: BuildAnalysisPromptInput): string {
  const strategyInstruction = getStrategyInstruction(strategy)
  const portfolioText = formatPortfolio(portfolio)

  return `
You are an investment portfolio analysis assistant.

${strategyInstruction}

Current portfolio:
${portfolioText}

Task:
1. Analyze the current portfolio allocation.
2. Explain the main strengths and weaknesses of the current allocation.
3. Suggest a better target allocation.
4. Explain why the suggested allocation is better under the selected strategy.
5. Mention major risks and uncertainties.

Rules:
- Be concise but specific.
- Do not invent exact financial data that was not provided.
- Treat CASH as available dry powder or defensive allocation.
- If target weights are missing, propose reasonable target weights.
- Make the reasoning practical for a retail investor.

Output format:
- Summary
- Problems in current allocation
- Suggested target allocation
- Rationale
- Risks
`.trim()
}
