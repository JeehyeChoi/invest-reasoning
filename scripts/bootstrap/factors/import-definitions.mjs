import dotenv from "dotenv";
dotenv.config({ path: ".env.local.psql" });

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const getEnv = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env variable: ${key}`);
  return value;
};

const pool = new Pool({
  connectionString: getEnv("DATABASE_URL"),
});

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const filePath = path.resolve(
      "scripts",
      "bootstrap",
      "factors",
      "factor-definitions.json",
    );

    const raw = await fs.readFile(filePath, "utf-8");
    const factors = JSON.parse(raw);

    let imported = 0;

    await client.query("DELETE FROM public.scenario_factor_shocks");
    await client.query("DELETE FROM public.factor_definitions");

    for (const item of factors) {
      await client.query(
        `
        INSERT INTO public.factor_definitions (
          key,
          name,
          category,
          description,
          interpretation_hint,
          polarity,
          is_active,
          display_order,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
        ON CONFLICT (key)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          interpretation_hint = EXCLUDED.interpretation_hint,
          polarity = EXCLUDED.polarity,
          is_active = EXCLUDED.is_active,
          display_order = EXCLUDED.display_order,
          updated_at = NOW()
        `,
        [
          item.key,
          item.name,
          item.category,
          item.description ?? null,
          item.interpretation_hint ?? null,
          item.polarity ?? null,
          item.is_active ?? true,
          item.display_order ?? 0,
        ],
      );

      imported += 1;
    }

    await client.query("COMMIT");
    console.log(`✅ Imported ${imported} factor definitions`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("import-factor-definitions failed");
  console.error(error);
  process.exit(1);
});
