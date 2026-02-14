import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DATE_FILTERS = new Set(["today", "yesterday", "week"]);

const stripHtml = (value) => {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const normalizePublishedAt = (rawDate) => {
  if (!rawDate) return new Date();
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const detectSource = (feedUrl, linkOrUrl) => {
  const target = `${feedUrl} ${linkOrUrl || ""}`.toLowerCase();
  if (target.includes("dou.ua")) return "dou";
  if (target.includes("djinni")) return "djinni";
  if (target.includes("robota.ua")) return "robota";
  return "unknown";
};

const extractCompanyFromTitle = (title) => {
  if (!title) return null;
  const match = title.match(/\sв\s([^,]+)/i);
  return match?.[1]?.trim() || null;
};

class VacancyWriteBuffer {
  constructor(pool, { batchSize, debounceMs }) {
    this.pool = pool;
    this.batchSize = batchSize;
    this.debounceMs = debounceMs;
    this.queue = [];
    this.timer = null;
    this.isFlushing = false;
  }

  enqueueMany(vacancies) {
    if (!vacancies || vacancies.length === 0) return;
    this.queue.push(...vacancies);

    if (this.queue.length >= this.batchSize) {
      this.flushSoon(0);
      return;
    }

    this.flushSoon(this.debounceMs);
  }

  flushSoon(timeoutMs) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush().catch((err) => {
        console.error("Помилка при batch insert вакансій:", err.message);
      });
    }, timeoutMs);
  }

  async flush() {
    if (this.isFlushing) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;

    this.isFlushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        await insertVacancies(this.pool, batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  async stop() {
    await this.flush();
  }
}

const buildMultiInsert = (rows) => {
  const values = [];
  const placeholders = rows
    .map((row, index) => {
      const offset = index * 10;
      values.push(
        row.id,
        row.externalId,
        row.title,
        row.company,
        row.description,
        row.url,
        row.source,
        row.publishedAt,
        JSON.stringify(row.rawData),
        new Date(),
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}::jsonb, $${offset + 10}, $${offset + 10})`;
    })
    .join(", ");

  return { placeholders, values };
};

const insertVacancies = async (pool, vacancies) => {
  if (vacancies.length === 0) return;

  const unique = [];
  const seen = new Set();

  for (const vacancy of vacancies) {
    if (seen.has(vacancy.externalId)) continue;
    seen.add(vacancy.externalId);
    unique.push(vacancy);
  }

  if (unique.length === 0) return;

  const { placeholders, values } = buildMultiInsert(unique);

  await pool.query(
    `
      INSERT INTO vacancies (
        id, external_id, title, company, description, url, source, published_at, raw_data, "createdAt", "updatedAt"
      )
      VALUES ${placeholders}
      ON CONFLICT (external_id) DO NOTHING
    `,
    values,
  );
};

class JobRepository {
  constructor({
    connectionString,
    writeBatchSize = 25,
    writeDebounceMs = 1500,
    readChunkSize = 200,
  }) {
    this.pool = new Pool({ connectionString });
    this.readChunkSize = readChunkSize;
    this.writer = new VacancyWriteBuffer(this.pool, {
      batchSize: writeBatchSize,
      debounceMs: writeDebounceMs,
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS bot_subscribers (
        chat_id BIGINT PRIMARY KEY,
        filter_keywords TEXT,
        date_filter TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT bot_subscribers_date_filter_check
          CHECK (date_filter IN ('today', 'yesterday', 'week') OR date_filter IS NULL)
      )
    `);
  }

  normalizeVacancy(feedUrl, item) {
    const link = pickFirstNonEmpty(item.link, item.url, item.id, feedUrl);
    const publishedRaw = pickFirstNonEmpty(
      item.isoDate,
      item.date_published,
      item.published,
      item.pubDate,
      item.date_modified,
    );
    const summaryText = pickFirstNonEmpty(
      item.contentSnippet,
      stripHtml(item.summary),
      stripHtml(item.content_html),
      stripHtml(item.content),
    );
    const fullContent = pickFirstNonEmpty(
      item.content,
      item.content_html,
      item.summary,
      summaryText,
    );
    const source = detectSource(feedUrl, link);
    const title = pickFirstNonEmpty(item.title, "Без назви");
    const baseId = item.guid || item.id || link || title;

    if (!baseId) return null;

    const normalizedItem = {
      ...item,
      link,
      contentSnippet: summaryText || "",
      content: fullContent || "",
      isoDate: publishedRaw || null,
    };

    return {
      id: randomUUID(),
      externalId: `${feedUrl}::${baseId}`,
      title,
      company:
        pickFirstNonEmpty(
          item.creator,
          item.author,
          item.company,
          extractCompanyFromTitle(title),
        ) || null,
      description: summaryText || fullContent || null,
      url: link,
      source,
      publishedAt: normalizePublishedAt(publishedRaw),
      rawData: {
        ...normalizedItem,
        feedUrl,
      },
      item: normalizedItem,
    };
  }

  async upsertSubscriber(chatId) {
    await this.pool.query(
      `
        INSERT INTO bot_subscribers (chat_id, filter_keywords, date_filter, created_at)
        VALUES ($1, NULL, NULL, NOW())
        ON CONFLICT (chat_id)
        DO UPDATE SET created_at = NOW()
      `,
      [chatId],
    );

    await this.pool.query(
      `
        INSERT INTO users (id, telegram_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (telegram_id) DO NOTHING
      `,
      [randomUUID(), chatId],
    );
  }

  async removeSubscriber(chatId) {
    await this.pool.query(`DELETE FROM bot_subscribers WHERE chat_id = $1`, [
      chatId,
    ]);
  }

  async getSubscriber(chatId) {
    const result = await this.pool.query(
      `
        SELECT
          chat_id,
          filter_keywords,
          date_filter,
          created_at
        FROM bot_subscribers
        WHERE chat_id = $1
      `,
      [chatId],
    );
    return result.rows[0] || null;
  }

  async setSubscriberFilters(chatId, filterKeywords) {
    await this.pool.query(
      `
        INSERT INTO bot_subscribers (chat_id, filter_keywords, date_filter, created_at)
        VALUES ($1, $2, NULL, NOW())
        ON CONFLICT (chat_id)
        DO UPDATE SET filter_keywords = EXCLUDED.filter_keywords
      `,
      [chatId, filterKeywords || null],
    );
  }

  async setSubscriberDateFilter(chatId, dateFilter) {
    const normalized =
      dateFilter && DATE_FILTERS.has(dateFilter) ? dateFilter : null;

    await this.pool.query(
      `
        INSERT INTO bot_subscribers (chat_id, filter_keywords, date_filter, created_at)
        VALUES ($1, NULL, $2, NOW())
        ON CONFLICT (chat_id)
        DO UPDATE SET date_filter = EXCLUDED.date_filter
      `,
      [chatId, normalized],
    );
  }

  async getAllSubscribers() {
    const result = await this.pool.query(`
      SELECT chat_id, filter_keywords, date_filter, created_at
      FROM bot_subscribers
      ORDER BY created_at ASC
    `);
    return result.rows;
  }

  async filterNewVacancies(vacancies) {
    if (vacancies.length === 0) return [];

    const externalIds = [...new Set(vacancies.map((job) => job.externalId))];
    const existing = new Set();

    for (let i = 0; i < externalIds.length; i += this.readChunkSize) {
      const chunk = externalIds.slice(i, i + this.readChunkSize);
      const result = await this.pool.query(
        `
          SELECT external_id
          FROM vacancies
          WHERE external_id = ANY($1::text[])
        `,
        [chunk],
      );

      for (const row of result.rows) {
        existing.add(row.external_id);
      }
    }

    return vacancies.filter((job) => !existing.has(job.externalId));
  }

  enqueueVacancies(vacancies) {
    this.writer.enqueueMany(vacancies);
  }

  async flushVacancies() {
    await this.writer.flush();
  }

  async getJobsToday() {
    await this.writer.flush();
    const result = await this.pool.query(`
      SELECT external_id AS id, title, url AS link, published_at
      FROM vacancies
      WHERE published_at >= date_trunc('day', NOW())
      ORDER BY published_at DESC
      LIMIT 100
    `);
    return result.rows;
  }

  async getJobsYesterday() {
    await this.writer.flush();
    const result = await this.pool.query(`
      SELECT external_id AS id, title, url AS link, published_at
      FROM vacancies
      WHERE published_at >= date_trunc('day', NOW()) - INTERVAL '1 day'
        AND published_at < date_trunc('day', NOW())
      ORDER BY published_at DESC
      LIMIT 100
    `);
    return result.rows;
  }

  async getJobsLastWeek() {
    await this.writer.flush();
    const result = await this.pool.query(`
      SELECT external_id AS id, title, url AS link, published_at
      FROM vacancies
      WHERE published_at >= NOW() - INTERVAL '7 day'
      ORDER BY published_at DESC
      LIMIT 200
    `);
    return result.rows;
  }

  async isVacancyStorageEmpty() {
    await this.writer.flush();
    const result = await this.pool.query(
      `SELECT 1 FROM vacancies LIMIT 1`,
    );
    return result.rows.length === 0;
  }

  async clearVacancies() {
    await this.writer.flush();
    await this.pool.query(`TRUNCATE TABLE vacancies`);
  }

  async countVacancies() {
    await this.writer.flush();
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM vacancies`,
    );
    return result.rows[0]?.count ?? 0;
  }

  async shutdown() {
    await this.writer.stop();
    await this.pool.end();
  }
}

export { JobRepository };
