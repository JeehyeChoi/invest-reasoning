import { db } from "@/backend/config/db";

export async function deleteCompanyFactRawRowsForCik(input: {
  cik: string;
}): Promise<number> {
  const result = await db.query(
    `DELETE FROM public.sec_companyfact_raw WHERE cik = $1`,
    [input.cik],
  );

  return result.rowCount ?? 0;
}

export async function truncateCompanyFactRawRows(): Promise<void> {
  await db.query(`TRUNCATE TABLE public.sec_companyfact_raw`);
}
