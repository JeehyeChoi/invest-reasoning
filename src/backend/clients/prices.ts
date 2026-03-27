type PriceMap = Record<string, number>

export const fetchPrices = async (
  tickers: string[]
): Promise<PriceMap> => {
  if (tickers.length === 0) {
    return {}
  }

  const res = await fetch("/api/prices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tickers }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to fetch prices: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.prices ?? {}
}


