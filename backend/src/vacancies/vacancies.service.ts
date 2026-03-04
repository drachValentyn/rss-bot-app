import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export type VacancyRow = {
  id: string;
  external_id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  source: string;
  published_at: Date;
  created_at: Date;
};

@Injectable()
export class VacanciesService {
  constructor(private readonly db: PrismaService) {}

  async findAll(limit = 50, offset = 0): Promise<VacancyRow[]> {
    const result = await this.db.query<VacancyRow>(
      `
        SELECT id, external_id, title, company, description, url, source,
               published_at, "createdAt" AS created_at
        FROM vacancies
        ORDER BY published_at DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );
    return result.rows;
  }

  async findOne(id: string): Promise<VacancyRow | null> {
    const result = await this.db.query<VacancyRow>(
      `
        SELECT id, external_id, title, company, description, url, source,
               published_at, "createdAt" AS created_at
        FROM vacancies
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async upsertMany(
    rows: {
      id: string;
      external_id: string;
      title: string;
      company: string | null;
      description: string | null;
      url: string;
      source: string;
      published_at: string;
      raw_data: Record<string, unknown>;
    }[],
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const now = new Date().toISOString();
    let upserted = 0;

    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk
        .map(
          (_, idx) =>
            `($${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, $${idx * 9 + 9})`,
        )
        .join(", ");

      const values = chunk.flatMap((r) => [
        r.id,
        r.external_id,
        r.title,
        r.company,
        r.description,
        r.url,
        r.source,
        r.published_at,
        JSON.stringify(r.raw_data),
      ]);

      await this.db.query(
        `
          INSERT INTO vacancies
            (id, external_id, title, company, description, url, source, published_at, raw_data, "createdAt", "updatedAt")
          SELECT
            v.id, v.external_id, v.title, v.company, v.description, v.url, v.source,
            v.published_at::timestamptz, v.raw_data::jsonb,
            '${now}'::timestamptz, '${now}'::timestamptz
          FROM (VALUES ${placeholders}) AS v(id, external_id, title, company, description, url, source, published_at, raw_data)
          ON CONFLICT (external_id) DO NOTHING
        `,
        values,
      );

      upserted += chunk.length;
    }

    return upserted;
  }
}
