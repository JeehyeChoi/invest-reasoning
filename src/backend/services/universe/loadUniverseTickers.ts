import { db } from "@/backend/config/db";
import {
  normalizeUniverseKeys,
  type UniverseKey,
} from "@/shared/universe/universes";

export type LoadUniverseTickersInput = {
  universeKeys?: UniverseKey[];
};

export async function loadUniverseTickers(
  input: LoadUniverseTickersInput = {},
): Promise<string[]> {
  const universeKeys = normalizeUniverseKeys(input.universeKeys);

  const result = await db.query<{ ticker: string }>(
    `
    SELECT DISTINCT ticker
    FROM universe_memberships
    WHERE universe_key = ANY($1::text[])
      AND is_active = true
    ORDER BY ticker
    `,
    [universeKeys],
  );

  return result.rows.map((row) => row.ticker);
}
