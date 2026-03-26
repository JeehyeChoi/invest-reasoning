import { ENV } from "@/backend/config/env"

type ClaudeAnalysisInput = {
  prompt: string
}

type ClaudeTextBlock = {
  type: "text"
  text: string
}

type ClaudeResponse = {
  content?: ClaudeTextBlock[]
}

export async function analyzeWithClaude({
  prompt,
}: ClaudeAnalysisInput): Promise<string> {
	const apiKey = ENV.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY")
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Claude API error: ${res.status} ${errorText}`)
  }

  const data = (await res.json()) as ClaudeResponse

  return data.content?.[0]?.text ?? ""
}
