import { resolveTickerMetadata } from "@/backend/services/metadata/resolveTickerMetadata"
import type { PortfolioAnalysisWorkflowStep } from "../workflow.types"

export const resolveMetadataStep: PortfolioAnalysisWorkflowStep = {
  name: "resolve_metadata",

  async run(context) {
    const tickers = Array.from(
      new Set(
        context.input.calculatedPortfolio
          .map((item) => item.ticker)
          .filter((ticker) => ticker !== "__CASH__"),
      ),
    )

    const metadataEntries = await Promise.all(
      tickers.map(async (ticker) => {
        const metadata = await resolveTickerMetadata(ticker)
        return [ticker, metadata] as const
      }),
    )

    const byTicker = Object.fromEntries(metadataEntries)

    return {
      ...context,
      artifacts: {
        ...context.artifacts,
        metadata: {
          byTicker,
          fetchedAt: new Date().toISOString(),
        },
      },
    }
  },
}
