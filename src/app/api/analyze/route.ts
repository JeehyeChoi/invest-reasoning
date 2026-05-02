import { runPortfolioAnalysisWorkflow } from "@/backend/workflows/portfolio-analysis/runPortfolioAnalysisWorkflow"
import { PortfolioAnalysisRequestSchema } from "@/shared/analysis/portfolioAnalysisContract"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const input = PortfolioAnalysisRequestSchema.parse(body)
    const workflowResult = await runPortfolioAnalysisWorkflow(input)

		return Response.json({
			result: workflowResult.artifacts?.exposure ?? "No report available yet",
			debug: {
				trace: workflowResult.trace,
				artifacts: workflowResult.artifacts,
			},
		})

  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
