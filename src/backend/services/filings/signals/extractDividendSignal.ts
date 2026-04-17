// backend/services/filings/signals/extractDividendSignal.ts

export type DividendSignal = {
  previousPerShare?: number | null;
  currentPerShare?: number | null;
  annualizedPerShare?: number | null;

  declaredDate?: string | null;
  recordDate?: string | null;
  paymentDate?: string | null;
};

export function extractDividendSignal(text: string): DividendSignal | null {
  if (!text) return null;

  const result: DividendSignal = {};

  // 🔹 per share increase (from → to)
  const increaseMatch = text.match(
    /from \$([0-9]+(?:\.[0-9]+)?) to \$([0-9]+(?:\.[0-9]+)?) per share/i
  );

  if (increaseMatch) {
    result.previousPerShare = Number(increaseMatch[1]);
    result.currentPerShare = Number(increaseMatch[2]);
  }

  // 🔹 annualized dividend
  const annualMatch = text.match(
    /\$([0-9]+(?:\.[0-9]+)?) on an annualized basis/i
  );

  if (annualMatch) {
    result.annualizedPerShare = Number(annualMatch[1]);
  }

  // 🔹 declared date
  const declaredMatch = text.match(
    /declared on ([A-Za-z]+ \d{1,2}, \d{4})/i
  );

  if (declaredMatch) {
    result.declaredDate = declaredMatch[1];
  }

  // 🔹 record date
  const recordMatch = text.match(
    /shareholders of record .* on ([A-Za-z]+ \d{1,2}, \d{4})/i
  );

  if (recordMatch) {
    result.recordDate = recordMatch[1];
  }

  // 🔹 payment date
  const payableMatch = text.match(
    /payable ([A-Za-z]+ \d{1,2}, \d{4})/i
  );

  if (payableMatch) {
    result.paymentDate = payableMatch[1];
  }

  return result;
}
