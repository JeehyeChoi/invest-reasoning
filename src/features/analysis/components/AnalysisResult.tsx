type Props = {
  result: unknown
}

export function AnalysisResult({ result }: Props) {
  const displayText =
    typeof result === "string"
      ? result
      : JSON.stringify(result, null, 2)

  return (
    <div className="p-4 border rounded bg-gray-50 whitespace-pre-wrap font-mono text-sm">
      {displayText}
    </div>
  )
}
