import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { XMLParser } from "fast-xml-parser";
import { randomUUID } from "node:crypto";
import { VacanciesService } from "../vacancies/vacancies.service";

type Source = "dou" | "djinni";

type FeedConfig = {
  source: Source;
  url: string;
};

type ParsedItem = {
  title: string;
  link: string;
  guid: string | null;
  id: string | null;
  description: string | null;
  content: string | null;
  author: string | null;
  published: string | null;
  raw: Record<string, unknown>;
};

const FEEDS: FeedConfig[] = [
  {
    source: "djinni",
    url: "https://djinni.co/jobs/rss/?primary_keyword=JavaScript&primary_keyword=React.js&primary_keyword=Fullstack&exp_level=2y&exp_level=3y&exp_level=4y&employment=remote",
  },
  {
    source: "dou",
    url: "https://jobs.dou.ua/vacancies/feeds/?category=Front+End&remote=",
  },
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

const pickFirstNonEmpty = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const stripHtml = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

const normalizePublishedAt = (rawDate: string | null): string => {
  if (!rawDate) return new Date().toISOString();
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const extractCompanyFromTitle = (title: string): string | null => {
  const match = title.match(/\sв\s([^,]+)/i);
  return match?.[1]?.trim() ?? null;
};

const asArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const textFromRaw = (raw: unknown): string | null => {
  if (typeof raw === "string") {
    const value = raw.trim();
    return value || null;
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const value = textFromRaw(entry);
      if (value) return value;
    }
    return null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return pickFirstNonEmpty(
      typeof obj["#text"] === "string" ? obj["#text"] : null,
      typeof obj["__cdata"] === "string" ? obj["__cdata"] : null,
    );
  }
  return null;
};

const childValueByLocalName = (
  node: Record<string, unknown>,
  names: string[],
): unknown => {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const [key, raw] of Object.entries(node)) {
    if (key.startsWith("@_")) continue;
    const normalizedKey = key.includes(":")
      ? key.split(":").pop()!.toLowerCase()
      : key.toLowerCase();
    if (wanted.has(normalizedKey)) return raw;
  }
  return null;
};

const childTextByLocalName = (node: Record<string, unknown>, names: string[]) =>
  textFromRaw(childValueByLocalName(node, names));

const extractAtomLink = (node: Record<string, unknown>): string | null => {
  const rawLink = childValueByLocalName(node, ["link"]);
  const linkEntries = asArray(rawLink);
  for (const entry of linkEntries) {
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const href = typeof obj["@_href"] === "string" ? obj["@_href"].trim() : null;
      const rel = typeof obj["@_rel"] === "string" ? obj["@_rel"].trim() : null;
      if (href && (!rel || rel === "alternate")) return href;
    }
  }
  for (const entry of linkEntries) {
    const direct = textFromRaw(entry);
    if (direct) return direct;
  }
  return null;
};

const parseRssItems = async (feed: FeedConfig): Promise<ParsedItem[]> => {
  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JobRSSWorker/1.0)",
      Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${feed.url}: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;

  const rssRoot = parsed["rss"] as { channel?: { item?: Record<string, unknown> | Record<string, unknown>[] } } | undefined;
  const rdfRoot = parsed["rdf:RDF"] as { item?: Record<string, unknown> | Record<string, unknown>[] } | undefined;
  const atomRoot = parsed["feed"] as { entry?: Record<string, unknown> | Record<string, unknown>[] } | undefined;

  const rssItems = asArray(rssRoot?.channel?.item);
  const rdfItems = asArray(rdfRoot?.item);
  const atomEntries = asArray(atomRoot?.entry);

  const itemNodes = rssItems.length > 0 ? rssItems : rdfItems.length > 0 ? rdfItems : atomEntries;
  if (itemNodes.length === 0) return [];

  return itemNodes.map((item) => {
    const title = pickFirstNonEmpty(childTextByLocalName(item, ["title"]), "Без назви")!;
    const link = pickFirstNonEmpty(
      extractAtomLink(item),
      childTextByLocalName(item, ["link"]),
      childTextByLocalName(item, ["id"]),
      title,
    )!;
    const description = pickFirstNonEmpty(
      childTextByLocalName(item, ["description"]),
      childTextByLocalName(item, ["summary"]),
    );
    const content = pickFirstNonEmpty(
      childTextByLocalName(item, ["encoded", "content"]),
      description,
    );
    const guid = pickFirstNonEmpty(childTextByLocalName(item, ["guid"]));
    const id = pickFirstNonEmpty(childTextByLocalName(item, ["id"]));
    const author = pickFirstNonEmpty(
      childTextByLocalName(item, ["creator", "author"]),
      childTextByLocalName(item, ["company"]),
    );
    const published = pickFirstNonEmpty(
      childTextByLocalName(item, ["pubDate", "published", "updated", "date"]),
    );

    return { title, link, guid, id, description, content, author, published, raw: { title, link, guid, id, description, content, author, published, source: feed.source, feedUrl: feed.url } };
  });
};

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);

  constructor(private readonly vacancies: VacanciesService) {}

  @Cron("0 9-19 * * *")
  async collectFeeds() {
    this.logger.log("RSS collection started");
    const result = await this.runCollection();
    this.logger.log(
      `RSS done: parsed=${result.parsed} unique=${result.unique}`,
    );
    return result;
  }

  async runCollection() {
    let parsedTotal = 0;
    const allRows: Parameters<VacanciesService["upsertMany"]>[0] = [];

    for (const feed of FEEDS) {
      try {
        const items = await parseRssItems(feed);
        this.logger.log(`${feed.source}: parsed ${items.length} items`);
        parsedTotal += items.length;

        for (const item of items) {
          const baseId = pickFirstNonEmpty(item.guid, item.id, item.link, item.title);
          if (!baseId) continue;

          const contentSnippet = pickFirstNonEmpty(
            stripHtml(item.description),
            stripHtml(item.content),
          );
          const description = pickFirstNonEmpty(contentSnippet, item.content, item.description);

          allRows.push({
            id: randomUUID(),
            external_id: `${feed.url}::${baseId}`,
            title: item.title,
            company: pickFirstNonEmpty(item.author, extractCompanyFromTitle(item.title)),
            description,
            url: item.link,
            source: feed.source,
            published_at: normalizePublishedAt(item.published),
            raw_data: { ...item.raw, contentSnippet: contentSnippet ?? "" },
          });
        }
      } catch (err) {
        this.logger.error(`${feed.source} error: ${(err as Error).message}`);
      }
    }

    const uniqueRows = Array.from(
      new Map(allRows.map((r) => [r.external_id, r])).values(),
    );

    await this.vacancies.upsertMany(uniqueRows);

    return { feeds: FEEDS.length, parsed: parsedTotal, unique: uniqueRows.length };
  }
}
