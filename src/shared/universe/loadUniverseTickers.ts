import fs from "fs";
import path from "path";
import { ENV } from "@/backend/config/env";

type TickerUniverseFile = {
  source?: string;
  generatedAt?: string;
  count?: number;
  tickers?: string[];
};

export async function loadUniverseTickers(): Promise<string[]> {
  const sp500Path = path.join(ENV.SEC_DATA_DIR, "sp500-tickers.json");

  if (!fs.existsSync(sp500Path)) {
    throw new Error(`sp500-tickers.json not found at ${sp500Path}`);
  }

  const parsed = JSON.parse(
    fs.readFileSync(sp500Path, "utf-8"),
  ) as TickerUniverseFile;

  const tickers = Array.isArray(parsed.tickers) ? parsed.tickers : [];

  return tickers
    .map((ticker) => ticker?.trim().toUpperCase())
    .filter((ticker): ticker is string => Boolean(ticker));
}
