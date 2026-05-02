// Export SEC taxonomy tag inventory from raw Company Facts rows.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";


const { Client } = pg;

const OUTPUT_DIR = path.join(
  process.cwd(),
  "data",
  "sec",
  "tag-inventory",
  "raw",
);

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("[sec-tag-inventory] fetching cik list...");

  const cikResult = await client.query(`
    SELECT DISTINCT cik
    FROM sec_companyfact_raw
    ORDER BY cik
  `);

  const ciks = cikResult.rows.map((r) => r.cik);

  console.log(`[sec-tag-inventory] total cik=${ciks.length}`);

  let processed = 0;

  for (const cik of ciks) {
    processed += 1;

    process.stdout.write(
      `\r[sec-tag-inventory] (${processed}/${ciks.length}) processing ${cik}`,
    );

    try {
      const result = await client.query(`
        SELECT
          tag,
          COUNT(*) AS n,
          COUNT(*) FILTER (WHERE fp = 'FY') AS fy_count,
          MIN(fy) AS min_fy,
          MAX(fy) AS max_fy,
          MIN(("end"::date - start::date + 1)) FILTER (WHERE start IS NOT NULL) AS min_duration_days,
          MAX(("end"::date - start::date + 1)) FILTER (WHERE start IS NOT NULL) AS max_duration_days
        FROM sec_companyfact_raw
        WHERE cik = $1
        GROUP BY tag
        ORDER BY fy_count DESC, n DESC, tag
      `, [cik]);

      const rows = result.rows;

      if (rows.length === 0) {
        continue;
      }

      const csv = buildCsv(rows);

      const filePath = path.join(OUTPUT_DIR, `${cik}.csv`);
      await fs.writeFile(filePath, csv, "utf8");

    } catch (err) {
      process.stdout.write("\n");
      console.error(`[sec-tag-inventory] failed cik=${cik}`, err);
    }
  }

  console.log("\n[sec-tag-inventory] done");
  await client.end();
}

function buildCsv(rows) {
  const header = [
    "tag",
    "n",
    "fy_count",
    "min_fy",
    "max_fy",
    "min_duration_days",
    "max_duration_days",
  ];

  const lines = [header.join(",")];

  for (const r of rows) {
    lines.push([
      r.tag,
      r.n,
      r.fy_count,
      r.min_fy,
      r.max_fy,
      r.min_duration_days,
      r.max_duration_days,
    ].join(","));
  }

  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
