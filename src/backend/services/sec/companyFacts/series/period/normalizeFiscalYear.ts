const MIN_REASONABLE_FISCAL_YEAR = 1900;
const MAX_REASONABLE_FISCAL_YEAR = 2100;

export function normalizeFiscalYear(
  fiscalYear: number | null | undefined,
): number | null {
  if (
    typeof fiscalYear !== "number" ||
    !Number.isInteger(fiscalYear) ||
    fiscalYear < MIN_REASONABLE_FISCAL_YEAR ||
    fiscalYear > MAX_REASONABLE_FISCAL_YEAR
  ) {
    return null;
  }

  return fiscalYear;
}
