import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import pg from "pg";

const { Pool } = pg;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    this.pool = new Pool({ connectionString });
  }

  async onModuleInit() {
    await this.pool.query("SELECT 1");
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }
}
