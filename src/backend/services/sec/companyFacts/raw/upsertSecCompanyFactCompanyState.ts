import { db } from "@/backend/config/db";

export type UpsertSecCompanyFactCompanyStateInput = {
  cik: string;
  entity_name: string | null;
  is_active: boolean;
  last_file_size: number;
  last_processed_at: string;
  last_filed: string | null;
  last_end: string | null;
};

export async function upsertSecCompanyFactCompanyState(
  input: UpsertSecCompanyFactCompanyStateInput
): Promise<void> {
  await db.query(
    `
      INSERT INTO sec_companyfact_company_state (
        cik,
        entity_name,
        is_active,
        last_file_size,
        last_processed_at,
        last_filed,
        last_end,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )
      ON CONFLICT (cik)
      DO UPDATE SET
        entity_name = EXCLUDED.entity_name,
        is_active = EXCLUDED.is_active,
        last_file_size = EXCLUDED.last_file_size,
        last_processed_at = EXCLUDED.last_processed_at,
        last_filed = EXCLUDED.last_filed,
        last_end = EXCLUDED.last_end,
        updated_at = NOW()
    `,
    [
      input.cik,
      input.entity_name,
      input.is_active,
      input.last_file_size,
      input.last_processed_at,
      input.last_filed,
      input.last_end,
    ]
  );
}
