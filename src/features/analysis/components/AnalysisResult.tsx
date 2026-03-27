type Props = {
  result: string
}

export function AnalysisResult({ result }: Props) {
  return (
    <div className="p-4 border rounded bg-gray-50 whitespace-pre-wrap">
      {result}
    </div>
  )
}
