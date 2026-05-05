import { db } from "@/backend/config/db";

export async function truncateCompanyFactRawRows(): Promise<void> {
  await db.query(`TRUNCATE TABLE public.sec_companyfact_raw`);
}
