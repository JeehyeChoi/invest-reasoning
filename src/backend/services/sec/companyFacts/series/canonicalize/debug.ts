export function shouldDebugSeries(ticker: string | null | undefined): boolean {
  return process.env.SEC_SERIES_DEBUG === "1" && ticker === "COST";
}

export function debugSeries(
  input: { ticker?: string | null },
  section: string,
  payload: unknown,
) {
  if (!shouldDebugSeries(input.ticker)) {
    return;
  }

  console.log(
    `[series:${input.ticker}:${section}]`,
    JSON.stringify(payload, null, 2),
  );
}
