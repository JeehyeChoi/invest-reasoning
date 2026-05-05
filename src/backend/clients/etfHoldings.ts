import type { EtfHoldingRecord } from "@/backend/clients/etfHoldings/types";
import yauzl from "yauzl";

const ISHARES_IJH_HOLDINGS_URL =
  "https://www.ishares.com/us/products/239763/ishares-core-sp-midcap-etf" +
  "/1467271812596.ajax?fileType=csv&fileName=IJH_holdings&dataType=fund";

const ISHARES_IJR_HOLDINGS_URL =
  "https://www.ishares.com/us/products/239774/ishares-core-sp-smallcap-etf" +
  "/1467271812596.ajax?fileType=csv&fileName=IJR_holdings&dataType=fund";

const SSGA_DIA_HOLDINGS_URL =
  "https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/" +
  "holdings-daily-us-en-dia.xlsx";

async function fetchEtfText(url: string, errorMessage: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GeoPortfolioEtfHoldings/1.0)",
      Accept: "text/csv,*/*",
    },
  });

  if (!res.ok) {
    const error = new Error(`${errorMessage}: ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return res.text();
}

async function fetchEtfBuffer(
  url: string,
  errorMessage: string,
): Promise<Buffer> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GeoPortfolioEtfHoldings/1.0)",
      Accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
    },
  });

  if (!res.ok) {
    const error = new Error(`${errorMessage}: ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function fetchIsharesIjhHoldings(): Promise<EtfHoldingRecord[]> {
  const csv = await fetchEtfText(
    ISHARES_IJH_HOLDINGS_URL,
    "iShares IJH holdings request failed",
  );

  return parseIsharesHoldingsCsv(csv);
}

export async function fetchIsharesIjrHoldings(): Promise<EtfHoldingRecord[]> {
  const csv = await fetchEtfText(
    ISHARES_IJR_HOLDINGS_URL,
    "iShares IJR holdings request failed",
  );

  return parseIsharesHoldingsCsv(csv);
}

export async function fetchSsgaDiaHoldings(): Promise<EtfHoldingRecord[]> {
  const buffer = await fetchEtfBuffer(
    SSGA_DIA_HOLDINGS_URL,
    "SSGA DIA holdings request failed",
  );

  return parseSsgaHoldingsXlsx(buffer);
}

function parseIsharesHoldingsCsv(csv: string): EtfHoldingRecord[] {
  const rows = parseCsvRows(csv);
  const headerIndex = rows.findIndex((row) => row.includes("Ticker"));

  if (headerIndex < 0) {
    throw new Error("Invalid iShares holdings CSV: missing Ticker header");
  }

  const header = rows[headerIndex];
  const tickerIndex = header.indexOf("Ticker");
  const nameIndex = header.indexOf("Name");
  const sectorIndex = header.indexOf("Sector");
  const assetClassIndex = header.indexOf("Asset Class");
  const exchangeIndex = header.indexOf("Exchange");

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const ticker = normalizeTicker(row[tickerIndex]);
    if (!ticker) return [];

    return {
      ticker,
      name: normalizeText(row[nameIndex]) ?? undefined,
      sector: normalizeText(row[sectorIndex]) ?? undefined,
      assetClass: normalizeText(row[assetClassIndex]) ?? undefined,
      exchange: normalizeText(row[exchangeIndex]) ?? undefined,
      sourcePayload: rowToPayload(header, row),
    };
  });
}

async function parseSsgaHoldingsXlsx(
  buffer: Buffer,
): Promise<EtfHoldingRecord[]> {
  const entries = await readXlsxEntries(buffer, [
    "xl/sharedStrings.xml",
    "xl/worksheets/sheet1.xml",
  ]);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
  const sheetRows = parseSheetRows(
    entries.get("xl/worksheets/sheet1.xml"),
    sharedStrings,
  );
  const headerIndex = sheetRows.findIndex(
    (row) => row.includes("Ticker") && row.includes("Name"),
  );

  if (headerIndex < 0) {
    throw new Error("Invalid SSGA holdings XLSX: missing holdings header");
  }

  const header = sheetRows[headerIndex];
  const tickerIndex = header.indexOf("Ticker");
  const nameIndex = header.indexOf("Name");
  const sectorIndex = header.indexOf("Sector");

  return sheetRows.slice(headerIndex + 1).flatMap((row) => {
    const ticker = normalizeTicker(row[tickerIndex]);
    if (!ticker) return [];

    return {
      ticker,
      name: normalizeText(row[nameIndex]) ?? undefined,
      sector: normalizeText(row[sectorIndex]) ?? undefined,
      sourcePayload: rowToPayload(header, row),
    };
  });
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  return rows;
}

function readXlsxEntries(
  buffer: Buffer,
  paths: string[],
): Promise<Map<string, string>> {
  const wanted = new Set(paths);

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError, zipfile) => {
      if (openError) {
        reject(openError);
        return;
      }
      if (!zipfile) {
        reject(new Error("Unable to open XLSX buffer"));
        return;
      }

      const entries = new Map<string, string>();

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (!wanted.has(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            zipfile.close();
            reject(streamError);
            return;
          }
          if (!stream) {
            zipfile.readEntry();
            return;
          }

          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("error", (error) => {
            zipfile.close();
            reject(error);
          });
          stream.on("end", () => {
            entries.set(entry.fileName, Buffer.concat(chunks).toString("utf8"));
            if (entries.size === wanted.size) {
              zipfile.close();
              resolve(entries);
              return;
            }
            zipfile.readEntry();
          });
        });
      });
      zipfile.on("end", () => resolve(entries));
      zipfile.on("error", reject);
    });
  });
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];

  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXmlEntities(
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((textMatch) => textMatch[1])
        .join(""),
    ),
  );
}

function parseSheetRows(
  xml: string | undefined,
  sharedStrings: string[],
): string[][] {
  if (!xml) return [];

  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: string[] = [];

    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const cellRef = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const cellIndex = cellRef ? columnNameToIndex(cellRef) : row.length;
      const normalizedValue = /\bt="s"/.test(attrs)
        ? sharedStrings[Number(value)] ?? ""
        : decodeXmlEntities(value);

      row[cellIndex] = normalizedValue;
    }

    return row.map((value) => value ?? "");
  });
}

function columnNameToIndex(value: string): number {
  let index = 0;

  for (const char of value) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }

  return index - 1;
}

function rowToPayload(
  header: string[],
  row: string[],
): Record<string, string> {
  const payload: Record<string, string> = {};

  header.forEach((key, index) => {
    const normalizedKey = key.trim();
    if (normalizedKey) payload[normalizedKey] = row[index] ?? "";
  });

  return payload;
}

function normalizeTicker(value: string | undefined): string | null {
  const normalized = normalizeText(value)?.toUpperCase();
  return normalized ? normalized.replace(/\s+/g, ".") : null;
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
