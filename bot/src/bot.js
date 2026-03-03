import { Bot } from "grammy";
import { formatJobMessage } from "./filters.js";

class JobBot {
  constructor(config, repository) {
    this.config = config;
    this.repo = repository;
    this.bot = new Bot(config.telegramToken);
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

  async start() {
    await this.setupCommands();
    this.bot.catch((err) => {
      console.error("Помилка grammY middleware:", err.error?.message || err);
    });
    this.bot.start();
    console.log("Бот запущений 🧠");
  }
}

export { JobBot };
