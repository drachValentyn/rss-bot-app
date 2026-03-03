import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DATE_FILTERS = new Set(["today", "yesterday", "week"]);

class JobRepository {
  constructor({ connectionString }) {
    this.pool = new Pool({ connectionString });
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

  async getJobsToday() {
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
    const result = await this.pool.query(`
      SELECT external_id AS id, title, url AS link, published_at
      FROM vacancies
      WHERE published_at >= NOW() - INTERVAL '7 day'
      ORDER BY published_at DESC
      LIMIT 200
    `);
    return result.rows;
  }

  async shutdown() {
    await this.pool.end();
  }
}

export { JobRepository };
