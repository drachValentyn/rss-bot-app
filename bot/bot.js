import { Bot } from "grammy";
import { RSSParser } from "rss-parser";
import { applyFilters, formatJobMessage, passDateFilter } from "./filters";

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
  }

  setupCommands() {
    this.bot.api.setMyCommands([
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
    ]);

    this.bot.command("start", (ctx) => {
      const chatId = ctx.chat.id;
      this.repo.upsertSubscriber(chatId);

      this.bot.api.sendMessage(
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

    this.bot.command("stop", (ctx) => {
      const chatId = ctx.chat.id;
      this.repo.removeSubscriber(chatId);

      this.bot.api.sendMessage(
        chatId,
        "Добре, більше не надсилатиму вакансії. 💤",
      );
    });

    this.bot.command("filters", (ctx) => {
      const chatId = ctx.chat.id;
      const sub = this.repo.getSubscriber(chatId);

      if (!sub) {
        this.bot.api.sendMessage(
          chatId,
          "Ти ще не підписаний. Напиши /start, щоб почати отримувати вакансії.",
        );
        return;
      }

      if (!sub.filter_keywords) {
        this.bot.api.sendMessage(
          chatId,
          "Зараз фільтри не встановлені. Я надсилаю всі вакансії з RSS.",
        );
      } else {
        this.bot.api.sendMessage(
          chatId,
          `Поточні фільтри:\n${sub.filter_keywords}\n\n` +
            "Можеш змінити їх командою:\n" +
            "/setfilters react, remote, middle",
        );
      }
    });

    this.bot.hears(/\/datefilter(?:\s+(today|yesterday|week|off))?/, (ctx) => {
      const match = ctx.match;
      const chatId = ctx.chat.id;
      const value = match?.[1];

      if (!value) {
        this.bot.api.sendMessage(
          chatId,
          "Приклади:\n/datefilter today\n/datefilter yesterday\n/datefilter week\n/datefilter off",
        );
        return;
      }

      const filter = value === "off" ? null : value;
      this.repo.setSubscriberDateFilter(chatId, filter);

      this.bot.api.sendMessage(chatId, `Фільтр по даті встановлено: ${value}`);
    });

    this.bot.command("clearfilters", (ctx) => {
      const chatId = ctx.chat.id;
      this.repo.setSubscriberFilters(chatId, null);
      this.bot.api.sendMessage(
        chatId,
        "Фільтри очищені. Тепер надсилатиму всі вакансії.",
      );
    });

    this.bot.hears(/\/setfilters(?:\s+(.+))?/, (ctx) => {
      const match = ctx.match;
      const chatId = ctx.chat.id;
      const filtersRaw = match?.[1] ? match[1].trim() : "";

      if (!filtersRaw) {
        this.bot.api.sendMessage(
          chatId,
          "Будь ласка, вкажи фільтри після команди.\nПриклад:\n" +
            "/setfilters react, remote, middle",
        );
        return;
      }

      this.repo.setSubscriberFilters(chatId, filtersRaw);
      this.bot.api.sendMessage(
        chatId,
        `Фільтри оновлено ✅\nТепер я надсилатиму тільки вакансії, де зустрічаються всі ці слова:\n${filtersRaw}`,
      );
    });

    this.bot.command("today", (ctx) => {
      const chatId = ctx.chat.id;
      const jobs = this.repo.getJobsToday();

      if (jobs.length === 0) {
        this.bot.api.sendMessage(chatId, "Сьогодні вакансій ще нема.");
        return;
      }

      jobs.forEach((job) => {
        this.bot.api.sendMessage(
          chatId,
          `💼 *${job.title}*\n[Переглянути вакансію](${job.link})`,
          { parse_mode: "Markdown" },
        );
      });
    });

    this.bot.command("yesterday", (ctx) => {
      const chatId = ctx.chat.id;
      const jobs = this.repo.getJobsYesterday();

      if (jobs.length === 0) {
        this.bot.api.sendMessage(chatId, "Вчора вакансій не було.");
        return;
      }

      jobs.forEach((job) => {
        this.bot.api.sendMessage(
          chatId,
          `💼 *${job.title}*\n[Переглянути вакансію](${job.link})`,
          { parse_mode: "Markdown" },
        );
      });
    });

    this.bot.command("week", (ctx) => {
      const chatId = ctx.chat.id;
      const jobs = this.repo.getJobsLastWeek();

      if (jobs.length === 0) {
        this.bot.api.sendMessage(
          chatId,
          "За останній тиждень вакансій не знайдено.",
        );
        return;
      }

      jobs.forEach((job) => {
        this.bot.api.sendMessage(
          chatId,
          `💼 *${job.title}*\n[Переглянути вакансію](${job.link})`,
          { parse_mode: "Markdown" },
        );
      });
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

      const subscribers = this.repo.getAllSubscribers();

      if (subscribers.length === 0) {
        console.log("Підписників немає, пропускаємо відправку.");
        return;
      }

      for (const feedUrl of this.config.rssFeeds) {
        let feed;
        try {
          feed = await this.rssParser.parseURL(feedUrl);
        } catch (err) {
          console.error("Помилка при читанні RSS:", feedUrl, err.message);
          continue;
        }

        for (const item of feed.items) {
          const baseId = item.guid || item.link || item.title;
          if (!baseId) continue;

          const jobId = `${feedUrl}::${baseId}`;

          if (this.repo.isJobSent(jobId)) {
            continue;
          }

          this.repo.markJobAsSent(jobId, item);

          for (const sub of subscribers) {
            if (!applyFilters(sub, item)) continue;
            if (!passDateFilter(sub, item)) continue;

            const message = formatJobMessage(item);

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

      console.log("Перевірка RSS завершена.");
    } catch (err) {
      console.error("Помилка в checkRSS:", err.message);
    } finally {
      this.isChecking = false;
    }
  }

  start() {
    this.setupCommands();
    setInterval(() => this.checkRSS(), this.config.pollInterval);
    this.checkRSS();
    this.bot.start();
    console.log("Бот запущений 🧠");
  }
}

export { JobBot };
