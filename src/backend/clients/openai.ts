import { ENV } from "@/backend/config/env"

type OpenAIAnalysisInput = {
  prompt: string
}

type OpenAIResponse = {
  output_text?: string
}

export async function analyzeWithOpenAI({
  prompt,
}: OpenAIAnalysisInput): Promise<string> {
  const apiKey = ENV.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      input: prompt,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${errorText}`)
  }

  const data = (await res.json()) as OpenAIResponse

  return data.output_text ?? ""
}
