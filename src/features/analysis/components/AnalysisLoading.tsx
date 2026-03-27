export function AnalysisLoading() {
  return (
    <div className="flex flex-col items-center gap-2 text-gray-600">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      <span>Analyzing...</span>
    </div>
  )
}
