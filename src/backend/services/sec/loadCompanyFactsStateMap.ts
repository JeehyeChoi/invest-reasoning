import { db } from "@/backend/config/db";

export type CompanyFactsCompanyState = {
  cik: string;
  last_file_size: number | null;
};

export async function loadCompanyFactsStateMap(): Promise<
  Map<string, CompanyFactsCompanyState>
> {
  const result = await db.query<CompanyFactsCompanyState>(`
    SELECT cik, last_file_size
    FROM sec_companyfact_company_state
  `);

  const map = new Map<string, CompanyFactsCompanyState>();

  for (const row of result.rows) {
    map.set(row.cik, row);
  }

  return map;
}
