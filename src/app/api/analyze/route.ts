import { NextResponse } from "next/server"
import { AnalyzeRequestSchema } from "@/features/analysis/schemas/analyzeRequest"

import { analyzeWithClaude } from "@/backend/clients/claude"
import { analyzeWithOpenAI } from "@/backend/clients/openai"
import { buildAnalysisPrompt } from "@/features/analysis/prompts/buildAnalysisPrompt"
import { ZodError } from "zod"


export async function POST(req: Request) {
  try {
    const rawBody = await req.json()
    const { provider, strategy, portfolio } = AnalyzeRequestSchema.parse(rawBody)

    const prompt = buildAnalysisPrompt({
      strategy,
      portfolio,
    })

		//console.log("prompt:", prompt)

    let result = ""
    if (provider === "claude") {
      result = await analyzeWithClaude({ prompt })
    } else if (provider === "openai") {
      result = await analyzeWithOpenAI({ prompt })
    } else {
      return NextResponse.json(
        { error: "Unsupported provider." },
        { status: 400 }
      )
    }

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
          details: error.issues,
        },
        { status: 400 }
      )
    }

    const message =
      error instanceof Error ? error.message : "Failed to analyze portfolio."

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
