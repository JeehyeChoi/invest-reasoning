import { NextResponse } from "next/server"
import { analyzeWithClaude } from "@/backend/clients/claude"
import { analyzeWithOpenAI } from "@/backend/clients/openai"
import {
  buildAnalysisPrompt,
  type AnalysisStrategy,
} from "@/features/analysis/prompts/buildAnalysisPrompt"
import type { PortfolioItemComputed } from "@/shared/types/portfolio"
import type { LlmProvider } from "@/shared/types/analysis"

type AnalyzeRequestBody = {
	provider?: LlmProvider
  strategy?: AnalysisStrategy
  portfolio?: PortfolioItemComputed[]
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody
    const { provider, strategy, portfolio } = body

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required." },
        { status: 400 }
      )
    }

    if (!strategy) {
      return NextResponse.json(
        { error: "Strategy is required." },
        { status: 400 }
      )
    }

    if (!portfolio || portfolio.length === 0) {
      return NextResponse.json(
        { error: "Portfolio is required." },
        { status: 400 }
      )
    }

    const prompt = buildAnalysisPrompt({
      strategy,
      portfolio,
    })

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
    console.error(error)

    return NextResponse.json(
      { error: "Failed to analyze portfolio." },
      { status: 500 }
    )
  }
}
