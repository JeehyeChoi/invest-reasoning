// backend/utils/sec.ts

export function normalizeCikForSubmissions(cik: string): string {
  const digits = cik.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export function normalizeCikForArchivePath(cik: string): string {
  const digits = cik.replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}
