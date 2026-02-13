import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL не знайдено");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const query = `
WITH candidates AS (
  SELECT
    id,
    COALESCE(
      NULLIF(raw_data->>'date_published', ''),
      NULLIF(raw_data->>'isoDate', ''),
      NULLIF(raw_data->>'pubDate', ''),
      NULLIF(raw_data->>'published', '')
    ) AS candidate_date,
    COALESCE(
      NULLIF(raw_data->>'link', ''),
      NULLIF(raw_data->>'url', '')
    ) AS candidate_url,
    COALESCE(
      NULLIF(raw_data->>'contentSnippet', ''),
      NULLIF(regexp_replace(raw_data->>'summary', '<[^>]*>', ' ', 'g'), ''),
      NULLIF(regexp_replace(raw_data->>'content_html', '<[^>]*>', ' ', 'g'), ''),
      NULLIF(raw_data->>'content', '')
    ) AS candidate_description,
    COALESCE(
      NULLIF(raw_data->>'creator', ''),
      NULLIF(raw_data->>'author', ''),
      NULLIF(raw_data->>'company', '')
    ) AS candidate_company
  FROM vacancies
)
UPDATE vacancies v
SET
  published_at = CASE
    WHEN c.candidate_date IS NOT NULL
      AND (
        c.candidate_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
        OR c.candidate_date ~ '^[A-Za-z]{3},'
      )
    THEN c.candidate_date::timestamptz
    ELSE v.published_at
  END,
  url = COALESCE(NULLIF(v.url, ''), c.candidate_url, v.url),
  description = COALESCE(v.description, c.candidate_description),
  company = COALESCE(v.company, c.candidate_company),
  source = CASE
    WHEN LOWER(COALESCE(v.url, c.candidate_url, '')) LIKE '%dou.ua%' THEN 'dou'
    WHEN LOWER(COALESCE(v.url, c.candidate_url, '')) LIKE '%djinni%' THEN 'djinni'
    WHEN LOWER(COALESCE(v.url, c.candidate_url, '')) LIKE '%robota.ua%' THEN 'robota'
    ELSE v.source
  END,
  "updatedAt" = NOW()
FROM candidates c
WHERE v.id = c.id
  AND (
    (c.candidate_date IS NOT NULL AND v.published_at >= NOW() - INTERVAL '2 day')
    OR (v.url IS NULL OR v.url = '')
    OR v.description IS NULL
    OR v.company IS NULL
    OR v.source = 'unknown'
  )
RETURNING v.id;
`;

try {
  console.log("Починаю backfill вакансій...");
  const result = await pool.query(query);
  console.log(`Оновлено вакансій: ${result.rowCount ?? 0}`);
} catch (error) {
  console.error("Помилка backfill:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
