import fs from "node:fs/promises";
import path from "node:path";

const CSV_URL =
  "https://datahub.io/core/s-and-p-500-companies/_r/-/data/constituents.csv";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  }
  return res.text();
}

function normalizeTicker(value) {
  return String(value ?? "").trim().toUpperCase();
}

function parseCsvFirstColumn(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  // header 제거
  const dataLines = lines.slice(1);

  return dataLines
    .map((line) => {
      // 첫 컬럼(Symbol)만 필요하므로 첫 comma 앞까지만 사용
      const firstColumn = line.split(",")[0];
      return normalizeTicker(firstColumn);
    })
    .filter(Boolean);
}

async function main() {
  console.log("Fetching S&P 500 constituents from DataHub...");

  const csvText = await fetchText(CSV_URL);
  const tickers = parseCsvFirstColumn(csvText);

	const outputDir = path.resolve("scripts", "data");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "sp500-tickers.json");

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        source: "datahub_sp500_constituents",
        generatedAt: new Date().toISOString(),
        count: tickers.length,
        tickers,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Saved ${tickers.length} tickers to ${outputPath}`);
}

main().catch((error) => {
  console.error("sync-sp500-constituents failed");
  console.error(error);
  process.exit(1);
});
