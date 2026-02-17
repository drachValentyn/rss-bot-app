import "server-only";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

export type VacancyRecord = {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  source: string;
  published_at: Date;
  created_at: Date;
};

const { Pool } = pg;

const readDatabaseUrlFromRootEnv = () => {
  try {
    const rootEnvPath = path.resolve(process.cwd(), "../.env");
    if (!fs.existsSync(rootEnvPath)) return undefined;

    const content = fs.readFileSync(rootEnvPath, "utf8");
    const line = content
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("DATABASE_URL="));
    if (!line) return undefined;

    const value = line.slice("DATABASE_URL=".length).trim();
    return value.replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
};

const connectionString =
  process.env.DATABASE_URL ?? readDatabaseUrlFromRootEnv();
if (!connectionString) {
  throw new Error("DATABASE_URL is not set for web-client");
}

const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const PAGE_SIZE = 12;

export const getVacanciesPage = async (page: number, pageSize = PAGE_SIZE) => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * pageSize;

  const [rowsResult, countResult] = await Promise.all([
    pool.query<VacancyRecord>(
      `
        SELECT
          id,
          title,
          company,
          description,
          url,
          source,
          published_at,
          "createdAt" AS created_at
        FROM vacancies
        ORDER BY published_at DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, offset],
    ),
    pool.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM vacancies
      `,
    ),
  ]);

  const total = countResult.rows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    vacancies: rowsResult.rows,
  };
};

export const getVacancyById = async (id: string) => {
  const result = await pool.query<VacancyRecord>(
    `
      SELECT
        id,
        title,
        company,
        description,
        url,
        source,
        published_at,
        "createdAt" AS created_at
      FROM vacancies
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
};
