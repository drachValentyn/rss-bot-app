import { Bot } from "grammy";
import RSSParser from "rss-parser";
import { applyFilters, formatJobMessage, passDateFilter } from "./filters.js";

class JobBot {
  constructor(config, repository) {
    this.config = config;
    this.repo = repository;
    this.bot = new Bot(config.telegramToken);
    this.rssParser = new RSSParser({
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobRSSBot/1.0; +https://t.me/jobs_rss_bot)",
        Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 10000,
    });
    this.isChecking = false;
    this.isWarmup = null;
  }

  async setupCommands() {
    const commands = [
      { command: "/start", description: "Почати роботу" },
      { command: "/today", description: "Вакансії за сьогодні" },
      { command: "/yesterday", description: "Вакансії за вчора" },
      { command: "/week", description: "Вакансії за тиждень" },
      { command: "/filters", description: "Показати ключові слова" },
      {
        command: "/datefilter",
        description: "Фільтр за датою автоматичних розсилок",
      },
      { command: "/stop", description: "Вимкнути надсилання" },
    ];

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.bot.api.setMyCommands(commands);
        break;
      } catch (err) {
        const isLastAttempt = attempt === maxAttempts;
        console.error(
          `setMyCommands помилка (спроба ${attempt}/${maxAttempts}):`,
          err.message,
        );
        if (isLastAttempt) {
          console.error(
            "Не вдалося оновити команди в Telegram. Бот продовжить роботу без оновлення меню команд.",
          );
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }

    this.bot.command("start", async (ctx) => {
      const chatId = ctx.chat.id;
      await this.repo.upsertSubscriber(chatId);

      await this.bot.api.sendMessage(
        chatId,
        [
          "Привіт! 🤖",
          "Я надсилатиму тобі нові вакансії з RSS-стрічок.",
          "",
          "Команди:",
          "• /stop — відписатися від розсилки",
          "• /filters — показати поточні фільтри",
          "• /setfilters react, remote, middle — встановити фільтри (через кому)",
          "• /clearfilters — прибрати всі фільтри",
        ].join("\n"),
      );
    });

    this.bot.command("stop", async (ctx) => {
      const chatId = ctx.chat.id;
      await this.repo.removeSubscriber(chatId);

      await this.bot.api.sendMessage(
        chatId,
        "Добре, більше не надсилатиму вакансії. 💤",
      );
    });

    this.bot.command("filters", async (ctx) => {
      const chatId = ctx.chat.id;
      const sub = await this.repo.getSubscriber(chatId);

      if (!sub) {
        await this.bot.api.sendMessage(
          chatId,
          "Ти ще не підписаний. Напиши /start, щоб почати отримувати вакансії.",
        );
        return;
      }

      if (!sub.filter_keywords) {
        await this.bot.api.sendMessage(
          chatId,
          "Зараз фільтри не встановлені. Я надсилаю всі вакансії з RSS.",
        );
      } else {
        await this.bot.api.sendMessage(
          chatId,
          `Поточні фільтри:\n${sub.filter_keywords}\n\n` +
            "Можеш змінити їх командою:\n" +
            "/setfilters react, remote, middle",
        );
      }
    });

    this.bot.hears(
      /\/datefilter(?:\s+(today|yesterday|week|off))?/,
      async (ctx) => {
        const match = ctx.match;
        const chatId = ctx.chat.id;
        const value = match?.[1];

        if (!value) {
          await this.bot.api.sendMessage(
            chatId,
            "Приклади:\n/datefilter today\n/datefilter yesterday\n/datefilter week\n/datefilter off",
          );
          return;
        }

        const filter = value === "off" ? null : value;
        await this.repo.setSubscriberDateFilter(chatId, filter);

        await this.bot.api.sendMessage(
          chatId,
          `Фільтр по даті встановлено: ${value}`,
        );
      },
    );

    this.bot.command("clearfilters", async (ctx) => {
      const chatId = ctx.chat.id;
      await this.repo.setSubscriberFilters(chatId, null);
      await this.bot.api.sendMessage(
        chatId,
        "Фільтри очищені. Тепер надсилатиму всі вакансії.",
      );
    });

    this.bot.hears(/\/setfilters(?:\s+(.+))?/, async (ctx) => {
      const match = ctx.match;
      const chatId = ctx.chat.id;
      const filtersRaw = match?.[1] ? match[1].trim() : "";

      if (!filtersRaw) {
        await this.bot.api.sendMessage(
          chatId,
          "Будь ласка, вкажи фільтри після команди.\nПриклад:\n" +
            "/setfilters react, remote, middle",
        );
        return;
      }

      await this.repo.setSubscriberFilters(chatId, filtersRaw);
      await this.bot.api.sendMessage(
        chatId,
        `Фільтри оновлено ✅\nТепер я надсилатиму тільки вакансії, де зустрічаються всі ці слова:\n${filtersRaw}`,
      );
    });

    this.bot.command("today", async (ctx) => {
      const chatId = ctx.chat.id;
      const jobs = await this.repo.getJobsToday();

      if (jobs.length === 0) {
        await this.bot.api.sendMessage(chatId, "Сьогодні вакансій ще нема.");
        return;
      }

      for (const job of jobs) {
        await this.bot.api.sendMessage(
          chatId,
          formatJobMessage(job, "/today"),
          { parse_mode: "Markdown" },
        );
      }
    });

    this.bot.command("yesterday", async (ctx) => {
      const chatId = ctx.chat.id;
      const jobs = await this.repo.getJobsYesterday();

      if (jobs.length === 0) {
        await this.bot.api.sendMessage(chatId, "Вчора вакансій не було.");
        return;
      }

      for (const job of jobs) {
        await this.bot.api.sendMessage(
          chatId,
          formatJobMessage(job, "/yesterday"),
          { parse_mode: "Markdown" },
        );
      }
    });

    this.bot.command("week", async (ctx) => {
      const chatId = ctx.chat.id;
      const jobs = await this.repo.getJobsLastWeek();

      if (jobs.length === 0) {
        await this.bot.api.sendMessage(
          chatId,
          "За останній тиждень вакансій не знайдено.",
        );
        return;
      }

      for (const job of jobs) {
        await this.bot.api.sendMessage(
          chatId,
          formatJobMessage(job, "/week"),
          { parse_mode: "Markdown" },
        );
      }
    });
  }

  async checkRSS() {
    if (this.isChecking) {
      console.log("Попередня перевірка RSS ще триває, пропускаємо цикл.");
      return;
    }

    this.isChecking = true;

    try {
      console.log("Перевірка RSS...");

      const subscribers = await this.repo.getAllSubscribers();

      if (subscribers.length === 0) {
        console.log("Підписників немає, пропускаємо відправку.");
        return;
      }

      if (this.isWarmup === null) {
        this.isWarmup = await this.repo.isVacancyStorageEmpty();
        if (this.isWarmup) {
          console.log(
            "Перший запуск: виконуємо початкову синхронізацію без розсилки старих вакансій.",
          );
        }
      }

      let warmupSaved = 0;

      for (const feedUrl of this.config.rssFeeds) {
        let feed;
        try {
          feed = await this.rssParser.parseURL(feedUrl);
        } catch (err) {
          console.error("Помилка при читанні RSS:", feedUrl, err.message);
          continue;
        }

        console.log(
          `[RSS] ${feedUrl} -> отримано ${feed.items.length} елементів`,
        );

        const normalized = feed.items
          .map((item) => this.repo.normalizeVacancy(feedUrl, item))
          .filter(Boolean);

        const newVacancies = await this.repo.filterNewVacancies(normalized);
        console.log(
          `[RSS] ${feedUrl} -> нових вакансій: ${newVacancies.length}`,
        );
        for (const vacancy of newVacancies) {
          console.log(
            `[NEW] ${vacancy.source} | ${vacancy.publishedAt.toISOString()} | ${vacancy.title}`,
          );
        }

        this.repo.enqueueVacancies(newVacancies);
        warmupSaved += newVacancies.length;

        if (this.isWarmup) {
          continue;
        }

        for (const vacancy of newVacancies) {
          const item = vacancy.item;

          for (const sub of subscribers) {
            if (!applyFilters(sub, item)) continue;
            if (!passDateFilter(sub, item)) continue;

            const message = formatJobMessage(item, "AUTO-RSS");

            try {
              await this.bot.api.sendMessage(sub.chat_id, message, {
                parse_mode: "Markdown",
                disable_web_page_preview: false,
              });
            } catch (err) {
              console.error(
                `Не вдалося надіслати повідомлення в chat ${sub.chat_id}:`,
                err.message,
              );
            }
          }
        }
      }

      await this.repo.flushVacancies();

      if (this.isWarmup) {
        console.log(
          `Початкова синхронізація завершена. Збережено ${warmupSaved} вакансій.`,
        );
        this.isWarmup = false;
      }

      console.log("Перевірка RSS завершена.");
    } catch (err) {
      console.error("Помилка в checkRSS:", err.message);
    } finally {
      this.isChecking = false;
    }
  }

  async start() {
    await this.setupCommands();
    setInterval(() => this.checkRSS(), this.config.pollInterval);
    this.checkRSS();
    this.bot.catch((err) => {
      console.error("Помилка grammY middleware:", err.error?.message || err);
    });
    this.bot.start();
    console.log("Бот запущений 🧠");
  }
}

export { JobBot };
