import { db } from "@/backend/config/db";

export async function getDatabaseSizeReport() {
  const databaseResult = await db.query(`
    SELECT
      current_database() AS database_name,
      pg_size_pretty(pg_database_size(current_database())) AS total_database_size,
      ROUND(pg_database_size(current_database()) / 1024 / 1024 / 1024.0, 2) AS total_database_gb
  `);

  const tablesResult = await db.query(`
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
      pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
      ROUND(pg_total_relation_size(c.oid) / 1024 / 1024 / 1024.0, 2) AS total_size_gb
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY pg_total_relation_size(c.oid) DESC
  `);

  const indexesResult = await db.query(`
    SELECT
      t.relname AS table_name,
      i.relname AS index_name,
      pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
      ROUND(pg_relation_size(i.oid) / 1024 / 1024 / 1024.0, 2) AS index_size_gb
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY pg_relation_size(i.oid) DESC
    LIMIT 5
  `);

  return {
    database: databaseResult.rows[0],
    tables: tablesResult.rows,
    largestIndexes: indexesResult.rows,
  };
}
