import { db } from "@/backend/config/db";

export async function truncateCompanyFactRawRows(): Promise<void> {
  await db.query(`TRUNCATE TABLE public.sec_companyfact_raw`);
}

export async function deleteCompanyFactTagSeriesRowsForCik(
  cik: string,
): Promise<void> {
  await db.query(`DELETE FROM public.sec_companyfact_tag_series WHERE cik = $1`, [
    cik,
  ]);
}
