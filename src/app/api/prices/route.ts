import { NextResponse } from "next/server"
import { ENV } from "@/backend/config/env"

const API_KEY = ENV.TWELVE_DATA_API_KEY

export async function POST(req: Request) {
  const { tickers } = await req.json()

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  try {
    const prices: Record<string, number> = {}

    await Promise.all(
      tickers.map(async (ticker: string) => {
        const res = await fetch(
          `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${API_KEY}`,
          { cache: "no-store" }
        )

        const data = await res.json()

        if (data?.price) {
          prices[ticker] = Number(data.price)
        }
      })
    )

    return NextResponse.json({ prices })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ prices: {} }, { status: 500 })
  }
}
