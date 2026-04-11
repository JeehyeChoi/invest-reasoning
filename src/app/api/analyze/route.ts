import { runPortfolioAnalysisWorkflow } from "@/backend/workflows/portfolio-analysis/runPortfolioAnalysisWorkflow"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const workflowResult = await runPortfolioAnalysisWorkflow(body)

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
