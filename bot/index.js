import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { JobBot } from "./src/bot.js";
import { JobRepository } from "./src/repo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared env for all apps (root) + optional bot-local overrides.
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env"), override: true });

const loadConfig = () => {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  if (!telegramToken) {
    console.error("TELEGRAM_TOKEN не вказаний у .env");
    process.exit(1);
  }

  const rssFeeds = (process.env.RSS_FEEDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (rssFeeds.length === 0) {
    console.error("RSS_FEEDS порожній. Додай хоча б один RSS у .env");
    process.exit(1);
  }

  const pollInterval = Number(process.env.POLL_INTERVAL || 300000);
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL не вказаний у .env");
    process.exit(1);
  }

  return {
    telegramToken,
    rssFeeds,
    pollInterval,
    databaseUrl,
    dbWriteBatchSize: Number(process.env.BOT_DB_WRITE_BATCH_SIZE || 25),
    dbWriteDebounceMs: Number(process.env.BOT_DB_WRITE_DEBOUNCE_MS || 1500),
    dbReadChunkSize: Number(process.env.BOT_DB_READ_CHUNK_SIZE || 200),
  };
};

const main = async () => {
  const config = loadConfig();
  const repo = new JobRepository({
    connectionString: config.databaseUrl,
    writeBatchSize: config.dbWriteBatchSize,
    writeDebounceMs: config.dbWriteDebounceMs,
    readChunkSize: config.dbReadChunkSize,
  });

  await repo.init();

  const app = new JobBot(config, repo);
  await app.start();

  const gracefulShutdown = async (signal) => {
    console.log(`Отримано ${signal}, завершуємо роботу...`);
    await repo.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    gracefulShutdown("SIGINT").catch((err) => {
      console.error("Помилка graceful shutdown:", err.message);
      process.exit(1);
    });
  });

  process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM").catch((err) => {
      console.error("Помилка graceful shutdown:", err.message);
      process.exit(1);
    });
  });
};

main().catch((err) => {
  console.error("Не вдалося запустити бота:", err.message);
  process.exit(1);
});
