export const applyFilters = (subscriber, item) => {
  if (!subscriber || !subscriber.filter_keywords) return true;

  const keywords = subscriber.filter_keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) return true;

  const text = (
    (item.title || "") +
    " " +
    (item.contentSnippet || "") +
    " " +
    (item.content || "")
  ).toLowerCase();

  return keywords.every((kw) => text.includes(kw.toLowerCase()));
};

export const passDateFilter = (sub, item) => {
  if (!sub.date_filter) return true; // немає фільтра
  if (!item.isoDate) return true; // фід без дати — пропускаємо

  const createdTime = new Date(item.isoDate).getTime();
  if (Number.isNaN(createdTime)) return true;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  switch (sub.date_filter) {
    case "today":
      return createdTime >= startOfToday.getTime();

    case "yesterday":
      return (
        createdTime >= startOfYesterday.getTime() &&
        createdTime < startOfToday.getTime()
      );

    case "week":
      return createdTime >= startOfWeek.getTime();

    default:
      return true;
  }
};

export const formatJobMessage = (item) => {
  const messageLines = [];
  messageLines.push(`💼 *${item.title || "Без назви"}*`);

  if (item.contentSnippet) {
    const shortText =
      item.contentSnippet.length > 400
        ? `${item.contentSnippet.slice(0, 400)}...`
        : item.contentSnippet;
    messageLines.push("");
    messageLines.push(shortText);
  }

  if (item.link) {
    messageLines.push("");
    messageLines.push(`[Переглянути вакансію](${item.link})`);
  }

  return messageLines.join("\n");
};
