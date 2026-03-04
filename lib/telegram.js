/**
 * Telegram Bot API через fetch (webhook, відправка повідомлень).
 */

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

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
  const body = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: true,
    ...options,
  };
  if (options.reply_markup) body.reply_markup = options.reply_markup;
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'sendMessage failed');
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
        { text: '🌤 Погода', callback_data: 'weather' },
        { text: '🧥 Що вдягнути', callback_data: 'outfit' },
      ],
      [
        { text: '🧠 Пояснення', callback_data: 'explain' },
        { text: '📍 Місто', callback_data: 'city' },
      ],
      [{ text: '⚙ Налаштування', callback_data: 'settings' }],
    ],
  };
}

export function buildSettingsKeyboard() {
  return {
    inline_keyboard: [
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
