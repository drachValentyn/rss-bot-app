import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import RSSParser from "rss-parser";
import { JobRepository } from "../src/repo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const databaseUrl = process.env.DATABASE_URL;
const rssFeeds = (process.env.RSS_FEEDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!databaseUrl) {
  console.error("DATABASE_URL не знайдено");
  process.exit(1);
}

if (rssFeeds.length === 0) {
  console.error("RSS_FEEDS порожній");
  process.exit(1);
}

const repo = new JobRepository({ connectionString: databaseUrl });
const rssParser = new RSSParser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; JobRSSBot/1.0; +https://t.me/jobs_rss_bot)",
    Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
  },
  timeout: 20000,
});

try {
  await repo.init();
  await repo.clearVacancies();
  console.log("Таблицю vacancies очищено.");

  let totalParsed = 0;
  let totalQueued = 0;

  for (const feedUrl of rssFeeds) {
    let feed;
    try {
      feed = await rssParser.parseURL(feedUrl);
    } catch (error) {
      console.error("Помилка читання RSS:", feedUrl, error.message);
      continue;
    }

    const normalized = feed.items
      .map((item) => repo.normalizeVacancy(feedUrl, item))
      .filter(Boolean);

    totalParsed += feed.items.length;
    totalQueued += normalized.length;
    repo.enqueueVacancies(normalized);

    console.log(
      `[RESEED] ${feedUrl}: RSS items ${feed.items.length}, для запису ${normalized.length}`,
    );
  }

  await repo.flushVacancies();
  const totalSaved = await repo.countVacancies();

  console.log(`Готово. Розібрано RSS: ${totalParsed}`);
  console.log(`Підготовлено до запису: ${totalQueued}`);
  console.log(`Фактично збережено в БД: ${totalSaved}`);
} catch (error) {
  console.error("RESEED помилка:", error.message);
  process.exitCode = 1;
} finally {
  await repo.shutdown();
}
