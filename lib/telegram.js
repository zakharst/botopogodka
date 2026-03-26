/**
 * Telegram Bot API через fetch (webhook, відправка повідомлень).
 */

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

/** Максимальна довжина text у sendMessage (HTML). */
const TG_TEXT_MAX = 4096;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getWebhookUrl() {
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v}/api/webhook`;
  return process.env.WEBHOOK_URL || '';
}

export async function setWebhook(url) {
  if (!BASE) throw new Error('TELEGRAM_TOKEN не задано');
  const res = await fetch(`${BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'setWebhook failed');
  return data;
}

export async function sendMessage(chatId, text, options = {}) {
  if (!BASE) throw new Error('TELEGRAM_TOKEN не задано');
  const { reply_markup, ...rest } = options;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: true,
    ...rest,
  };
  if (reply_markup != null) {
    body.reply_markup = typeof reply_markup === 'string' ? reply_markup : JSON.stringify(reply_markup);
  }
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'sendMessage failed');
  return data;
}

/** Надіслати довгий текст кількома повідомленнями (прогноз на тиждень / 2 тижні). */
export async function sendLongMessage(chatId, text, options = {}) {
  const body = text != null && text !== '' ? text : '—';
  if (body.length <= TG_TEXT_MAX) {
    return sendMessage(chatId, body, options);
  }
  const { reply_markup, ...rest } = options;
  const chunks = [];
  let remaining = body;
  while (remaining.length > TG_TEXT_MAX) {
    let cut = remaining.lastIndexOf('\n\n', TG_TEXT_MAX);
    if (cut < 200) cut = remaining.lastIndexOf('\n', TG_TEXT_MAX);
    if (cut < 200) cut = TG_TEXT_MAX;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
    if (!remaining.length) break;
  }
  if (remaining.length) chunks.push(remaining);
  let data;
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    data = await sendMessage(chatId, chunks[i], {
      ...rest,
      reply_markup: isLast ? reply_markup : undefined,
    });
    if (!isLast) await sleep(100);
  }
  return data;
}

export async function answerCallbackQuery(callbackQueryId, options = {}) {
  if (!BASE) throw new Error('TELEGRAM_TOKEN не задано');
  const res = await fetch(`${BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: options.text,
      show_alert: options.show_alert || false,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'answerCallbackQuery failed');
  return data;
}

export async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  if (!BASE) throw new Error('TELEGRAM_TOKEN не задано');
  const res = await fetch(`${BASE}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'editMessageReplyMarkup failed');
  return data;
}

export function buildMainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🌤 Погода зараз', callback_data: 'weather' },
        { text: '🧥 Що вдягнути', callback_data: 'outfit' },
      ],
      [{ text: '📅 Погода на потім', callback_data: 'weather_later' }],
      [{ text: '⚙ Налаштування', callback_data: 'settings' }],
    ],
  };
}

/** Клавіатура вибору прогнозу: вихідні, тиждень, 2 тижні. */
export function buildWeatherLaterKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📅 Вихідні (субота та неділя)', callback_data: 'weather_weekend' }],
      [{ text: '📆 Тиждень', callback_data: 'weather_week' }],
      [{ text: '📆 На 2 тижні', callback_data: 'weather_14days' }],
      [{ text: '🌡 Коли нарешті потепліє?', callback_data: 'weather_warm_when' }],
      [{ text: '← Назад', callback_data: 'back_menu' }],
    ],
  };
}

/** Клавіатура «Поділитися геолокацією» під час введення міста. */
export function buildLocationRequestKeyboard() {
  return {
    keyboard: [[{ text: '📍 Поділитися геолокацією', request_location: true }]],
    one_time_keyboard: true,
    resize_keyboard: true,
  };
}

/** Прибрати reply-клавіатуру після вибору міста. */
export function removeReplyKeyboard() {
  return { remove_keyboard: true };
}

export function buildSettingsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📍 Місто', callback_data: 'city' }],
      [
        { text: '👤 Профіль', callback_data: 'profile' },
        { text: '⏰ Час нагадування', callback_data: 'time_settings' },
      ],
      [{ text: '❓ Допомога', callback_data: 'help' }],
      [{ text: '🔄 Почати спочатку', callback_data: 'restart' }],
      [{ text: '← Назад', callback_data: 'back_menu' }],
    ],
  };
}
