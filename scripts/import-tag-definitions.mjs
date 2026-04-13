import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

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

function buildDescription(name, category) {
  switch (category) {
    case "sector":
      return `Companies classified in the ${name} sector.`;
    case "industry":
      return `Companies classified in the ${name} industry.`;
    case "listing":
      return `${name} listing or trading structure tag.`;
    case "size_style":
      return `${name} size classification based on market capitalization.`;
    case "risk_style":
      return `${name} risk classification based on beta.`;
    case "income_style":
      return `${name} income classification based on dividend yield.`;
    default:
      return `${name} tag.`;
  }
}

function categoryOrder(category) {
  switch (category) {
    case "sector":
      return 1;
    case "industry":
      return 2;
    case "listing":
      return 3;
    case "size_style":
      return 4;
    case "risk_style":
      return 5;
    case "income_style":
      return 6;
    default:
      return 99;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    const filePath = path.resolve(
      "scripts",
      "data",
      "tag-definition-candidates.json",
    );

    const raw = await fs.readFile(filePath, "utf-8");
    const candidates = JSON.parse(raw);

    const sorted = [...candidates].sort((a, b) => {
      const catDiff = categoryOrder(a.category) - categoryOrder(b.category);
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });

    let inserted = 0;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const displayOrder = (i + 1) * 10;
      const description = buildDescription(item.name, item.category);

      await client.query(
        `
        INSERT INTO tag_definitions (
          key,
          name,
          category,
          description,
          is_active,
          display_order,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, true, $5, NOW(), NOW()
        )
        ON CONFLICT (key)
        DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          is_active = true,
          display_order = EXCLUDED.display_order,
          updated_at = NOW()
        `,
        [
          item.key,
          item.name,
          item.category,
          description,
          displayOrder,
        ],
      );

      inserted += 1;
    }

    console.log(`✅ Imported ${inserted} tag definitions`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("import-tag-definitions failed");
  console.error(error);
  process.exit(1);
});
