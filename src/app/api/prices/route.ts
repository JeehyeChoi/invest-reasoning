import { NextResponse } from "next/server"
import { ENV } from "@/backend/config/env"

const API_KEY = ENV.TWELVE_DATA_API_KEY

const PRICE_CACHE = new Map<
  string,
  {
    price: number
    fetchedAt: number
  }
>()

const MAX_TICKERS_PER_REQUEST = 8
const CACHE_TTL_MS = 1000 * 60 * 30 // 30 minutes

async function fetchPrice(ticker: string) {
  const res = await fetch(
    `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${API_KEY}`,
    { cache: "no-store" }
  )

  const data = await res.json()

  if (!res.ok || !data?.price) {
    throw new Error(data?.message || `Failed to fetch price for ${ticker}`)
  }

  const price = Number(data.price)

  if (!Number.isFinite(price)) {
    throw new Error(`Invalid price for ${ticker}`)
  }

  return price
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawTickers = body?.tickers

    if (!Array.isArray(rawTickers) || rawTickers.length === 0) {
      return NextResponse.json({
        prices: {},
        staleTickers: [],
        failedTickers: [],
        warnings: [],
        fetchedAt: null,
      })
    }

    const uniqueTickers = [...new Set(
      rawTickers
        .map((ticker) => String(ticker).trim().toUpperCase())
        .filter(Boolean)
    )]

    if (uniqueTickers.length > MAX_TICKERS_PER_REQUEST) {
      return NextResponse.json(
        {
          prices: {},
          staleTickers: [],
          failedTickers: uniqueTickers,
          warnings: [
            `Too many tickers requested. Max ${MAX_TICKERS_PER_REQUEST} tickers per request.`,
          ],
          fetchedAt: null,
        },
        { status: 400 }
      )
    }

    const prices: Record<string, number> = {}
    const staleTickers: string[] = []
    const failedTickers: string[] = []
    const warnings: string[] = []

    await Promise.allSettled(
      uniqueTickers.map(async (ticker) => {
        try {
          const price = await fetchPrice(ticker)

          prices[ticker] = price
          PRICE_CACHE.set(ticker, {
            price,
            fetchedAt: Date.now(),
          })
        } catch (error) {
          const cached = PRICE_CACHE.get(ticker)

          if (cached) {
            prices[ticker] = cached.price
            staleTickers.push(ticker)
          } else {
            failedTickers.push(ticker)
          }

          console.error(`[prices] ${ticker}:`, error)
        }
      })
    )

    if (staleTickers.length > 0) {
      warnings.push(`Showing cached prices for: ${staleTickers.join(", ")}`)
    }

    if (failedTickers.length > 0) {
      warnings.push(`Failed to load prices for: ${failedTickers.join(", ")}`)
    }

    return NextResponse.json({
      prices,
      staleTickers,
      failedTickers,
      warnings,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[prices] route error:", error)

    return NextResponse.json(
      {
        prices: {},
        staleTickers: [],
        failedTickers: [],
        warnings: ["Invalid price request."],
        fetchedAt: null,
      },
      { status: 400 }
    )
  }
}
