import { PortfolioAnalysisRequestSchema } from "@/shared/analysis/portfolioAnalysisContract";
import type {
  PortfolioAnalysisWorkflowStep,
  PortfolioAnalysisWorkflowContext,
} from "./workflow.types";

import { resolveMetadataStep } from "./steps/resolveMetadataStep"
import { computeExposureStep } from "./steps/computeExposureStep"

export async function runPortfolioAnalysisWorkflow(
  rawInput: unknown,
): Promise<PortfolioAnalysisWorkflowContext> {
  const input = PortfolioAnalysisRequestSchema.parse(rawInput);
  //console.log("[workflow:start] input:", input);
	
  const steps: PortfolioAnalysisWorkflowStep[] = [
	  resolveMetadataStep,
    computeExposureStep,
  ];
	
	
	let context: PortfolioAnalysisWorkflowContext = {
		input,
		artifacts: {},
		trace: [],
	};


  for (const step of steps) {
    context.trace.push({
      step: step.name,
      status: "running",
      startedAt: new Date().toISOString(),
    })

    const traceEntry = context.trace[context.trace.length - 1]

    try {
      context = await step.run(context)
      //console.log(`[workflow:after] step=${step.name}`, { artifacts: context.artifacts });

      traceEntry.status = "completed"
      traceEntry.finishedAt = new Date().toISOString()
    } catch (error) {
      traceEntry.status = "failed"
      traceEntry.finishedAt = new Date().toISOString()
      traceEntry.error =
        error instanceof Error ? error.message : "Unknown workflow error"
	    //console.error(`[workflow:error] step=${step.name}`, error);
			
      throw error
    }
  }

	return {
		input: context.input,
		trace: context.trace,
		artifacts: context.artifacts,
	}
}
