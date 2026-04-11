import fs from "node:fs/promises"

const NASDAQ_URL = "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
const OTHER_URL = "https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt"

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  return res.text()
}

function parsePipeFile(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const rows = lines.map((line) => line.split("|"))

  const header = rows[0]
  const dataRows = rows.slice(1).filter((row) => row[0] !== "File Creation Time:")

  return { header, dataRows }
}

function parseNasdaqListed(text) {
  const { dataRows } = parsePipeFile(text)

  return dataRows
    .filter((row) => row[0] && row[1] && row[0] !== "Symbol")
    .map((row) => ({
      ticker: row[0],
      name: row[1],
      exchange: "NASDAQ",
    }))
}

function parseOtherListed(text) {
  const { dataRows } = parsePipeFile(text)

  return dataRows
    .filter((row) => row[0] && row[1] && row[0] !== "ACT Symbol")
    .map((row) => ({
      ticker: row[0],
      name: row[1],
      exchange: row[2],
    }))
}

function uniqueByTicker(items) {
  const map = new Map()

  for (const item of items) {
    if (!item.ticker) continue
    if (!map.has(item.ticker)) {
      map.set(item.ticker, item)
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.ticker.localeCompare(b.ticker)
  )
}

function toTsFile(items) {
  return `export type TickerEntry = {
  ticker: string
  name: string
  exchange: string
}

export const TICKERS: TickerEntry[] = ${JSON.stringify(items, null, 2)} as const
`
}

async function main() {
  const [nasdaqText, otherText] = await Promise.all([
    fetchText(NASDAQ_URL),
    fetchText(OTHER_URL),
  ])

  const nasdaqItems = parseNasdaqListed(nasdaqText)
	const otherItems = parseOtherListed(otherText).filter(
		(item) =>
			(item.exchange === "N" || item.exchange === "P") &&
			item.testIssue !== "Y"
	)

  const allItems = uniqueByTicker([...nasdaqItems, ...otherItems])

  const output = toTsFile(allItems)

  await fs.mkdir("src/shared/constants", { recursive: true })
  await fs.writeFile(
    "src/shared/constants/tickers.ts",
    output,
    "utf8"
  )

  console.log(
    `Wrote ${allItems.length} tickers to src/shared/constants/tickers.ts`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
