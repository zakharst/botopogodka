/**
 * Telegram webhook. Обробка update_id для ідемпотентності, маршрутизація по командах та callback.
 */

import * as storage from '../lib/storage.js';
import * as state from '../lib/state.js';
import * as telegram from '../lib/telegram.js';
import * as weather from '../lib/weather.js';
import * as format from '../lib/format.js';
import * as ai from '../lib/ai.js';
import * as fallback from '../lib/fallback_advice.js';
import { PROFILES } from '../lib/storage.js';

const HELP_TEXT = `<b>Допомога</b>

<b>Команди:</b>
/start — головне меню
/help — ця довідка

<b>Меню:</b>
• <b>Погода зараз</b> — поточна погода у вашому місті (потрібно спочатку вказати місто).
• <b>Що вдягнути</b> — рекомендації одягу з урахуванням погоди та обраного профілю (AI або правило-фолбек).
• <b>Пояснення</b> — коротке пояснення погоди (AI або фолбек).
• <b>Профіль</b> — обрати сценарій: офіс, прогулянка, біг, авто, з дитиною, мото/скутер.
• <b>Місто</b> — вказати «місто, країна» (наприклад: Тернопіль, Україна). Час і автопости рахуються за локальним часом цього міста.
• <b>Налаштування часу</b> — увімкнути/вимкнути автопости о 07:30 та 20:00 за <i>вашим</i> локальним часом міста та задати свої години.

Усі автопости відправляються за локальним часом міста, яке ви обрали (часовий пояс з OpenWeather).`;

function parseTime(str) {
  const t = str.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ ok: false });
    return;
  }
  const update = body;
  const updateId = update.update_id;
  if (updateId == null) {
    res.status(200).json({ ok: true });
    return;
  }
  try {
    const lastId = await storage.getLastProcessedUpdateId();
    if (updateId <= lastId) {
      res.status(200).json({ ok: true });
      return;
    }
    await storage.setLastProcessedUpdateId(updateId);
  } catch (e) {
    console.error('Redis update_id:', e);
    res.status(200).json({ ok: true });
    return;
  }

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error('Webhook handler:', err);
    const chatId = update.callback_query?.message?.chat?.id ?? update.message?.chat?.id;
    if (chatId) {
      try {
        await telegram.sendMessage(chatId, 'Виникла помилка. Спробуйте пізніше або /start.');
      } catch (_) {}
    }
  }
  res.status(200).json({ ok: true });
}

async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const data = cq.data || '';
  const telegramId = String(cq.from.id);

  await telegram.answerCallbackQuery(cq.id, {});

  if (data === 'weather') {
    await actionWeather(chatId, telegramId);
    return;
  }
  if (data === 'outfit') {
    const user = await storage.getUser(telegramId);
    const keyboard = {
      inline_keyboard: PROFILES.map(p => [
        { text: format.profileLabel(p) + (user.profile === p ? ' ✓' : ''), callback_data: `outfit:${p}` },
      ]),
    };
    await telegram.sendMessage(chatId, '🧥 Оберіть профіль для поради «Що вдягнути»:', { reply_markup: keyboard });
    return;
  }
  if (data.startsWith('outfit:')) {
    const profile = data.replace('outfit:', '');
    if (PROFILES.includes(profile)) {
      await storage.setUser(telegramId, { profile });
      await actionOutfit(chatId, telegramId);
    }
    return;
  }
  if (data === 'explain') {
    await actionExplain(chatId, telegramId);
    return;
  }
  if (data === 'profile') {
    const user = await storage.getUser(telegramId);
    const keyboard = {
      inline_keyboard: PROFILES.map(p => [{ text: format.profileLabel(p) + (user.profile === p ? ' ✓' : ''), callback_data: `profile:${p}` }]),
    };
    await telegram.sendMessage(chatId, format.formatProfileMenu(user.profile), { reply_markup: keyboard });
    return;
  }
  if (data.startsWith('profile:')) {
    const profile = data.replace('profile:', '');
    if (PROFILES.includes(profile)) {
      await storage.setUser(telegramId, { profile });
      await telegram.sendMessage(chatId, `Профіль змінено на «${format.profileLabel(profile)}».`, { reply_markup: telegram.buildMainKeyboard() });
    }
    return;
  }
  if (data === 'city') {
    await state.setInputState(chatId, 'awaiting_city');
    await telegram.sendMessage(chatId, 'Введіть місто у форматі «місто, країна», наприклад:\n• Тернопіль, Україна\n• Київ, UA\n• Ternopil, UA\n• Kraków, Poland');
    return;
  }
  if (data === 'time_settings') {
    const user = await storage.getUser(telegramId);
    const keyboard = {
      inline_keyboard: [
        [
          { text: user.autopostMorning ? 'Ранок ВИМК' : 'Ранок УВІМК', callback_data: user.autopostMorning ? 'time_morning_off' : 'time_morning_on' },
          { text: user.autopostEvening ? 'Вечір ВИМК' : 'Вечір УВІМК', callback_data: user.autopostEvening ? 'time_evening_off' : 'time_evening_on' },
        ],
        [{ text: 'Час ранку (07:30)', callback_data: 'time_set_morning' }],
        [{ text: 'Час вечора (20:00)', callback_data: 'time_set_evening' }],
        [{ text: '← Назад', callback_data: 'back_menu' }],
      ],
    };
    await telegram.sendMessage(chatId, format.formatTimeSettings(user), { reply_markup: keyboard });
    return;
  }
  if (data === 'time_morning_on') {
    await storage.setUser(telegramId, { autopostMorning: true });
    const user = await storage.getUser(telegramId);
    await telegram.sendMessage(chatId, 'Ранковий автопост увімкнено о ' + (user.morningTime || '07:30') + ' за вашим локальним часом.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'time_morning_off') {
    await storage.setUser(telegramId, { autopostMorning: false });
    await telegram.sendMessage(chatId, 'Ранковий автопост вимкнено.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'time_evening_on') {
    await storage.setUser(telegramId, { autopostEvening: true });
    const user = await storage.getUser(telegramId);
    await telegram.sendMessage(chatId, 'Вечірній автопост увімкнено о ' + (user.eveningTime || '20:00') + ' за вашим локальним часом.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'time_evening_off') {
    await storage.setUser(telegramId, { autopostEvening: false });
    await telegram.sendMessage(chatId, 'Вечірній автопост вимкнено.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'time_set_morning') {
    await state.setInputState(chatId, 'awaiting_morning_time');
    await telegram.sendMessage(chatId, 'Введіть час ранкового повідомлення у форматі ГГ:ХХ (наприклад 07:30):');
    return;
  }
  if (data === 'time_set_evening') {
    await state.setInputState(chatId, 'awaiting_evening_time');
    await telegram.sendMessage(chatId, 'Введіть час вечірнього повідомлення у форматі ГГ:ХХ (наприклад 20:00):');
    return;
  }
  if (data === 'back_menu' || data === 'help') {
    if (data === 'help') {
      await telegram.sendMessage(chatId, HELP_TEXT, { reply_markup: telegram.buildMainKeyboard() });
    } else {
      await telegram.sendMessage(chatId, 'Головне меню:', { reply_markup: telegram.buildMainKeyboard() });
    }
    return;
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const text = (msg.text || '').trim();

  if (text === '/start') {
    await telegram.sendMessage(chatId, 'Вітаю! Ось головне меню. Спочатку вкажіть місто в «📍 Місто».', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (text === '/help') {
    await telegram.sendMessage(chatId, HELP_TEXT, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }

  const inputState = await state.getInputState(chatId);
  if (inputState?.state === 'awaiting_city') {
    await state.clearInputState(chatId);
    if (!text) {
      await telegram.sendMessage(chatId, 'Місто не вказано. Спробуйте ще раз або /start.');
      return;
    }
    let geo;
    try {
      geo = await weather.geocode(text);
    } catch (e) {
      await telegram.sendMessage(chatId, 'Не вдалося знайти місто. Перевірте написання (місто, країна) і спробуйте знову.');
      return;
    }
    if (!geo) {
      await telegram.sendMessage(chatId, 'Місто не знайдено. Спробуйте ще раз у форматі «місто, країна» або «місто, UA» (наприклад: Тернопіль, Україна або Ternopil, UA).');
      return;
    }
    let timezoneOffsetSeconds = null;
    try {
      const oneCall = await weather.getOneCall(geo.lat, geo.lon);
      timezoneOffsetSeconds = oneCall.timezoneOffsetSeconds;
    } catch (_) {}
    await storage.setUser(telegramId, {
      city: `${geo.lat},${geo.lon}`,
      cityDisplay: geo.displayName,
      lat: geo.lat,
      lon: geo.lon,
      timezoneOffsetSeconds,
    });
    await telegram.sendMessage(chatId, `Місто збережено: ${geo.displayName}. Тепер можете дивитися погоду та поради.`, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (inputState?.state === 'awaiting_morning_time') {
    await state.clearInputState(chatId);
    const parsed = parseTime(text);
    if (!parsed) {
      await telegram.sendMessage(chatId, 'Невірний формат. Введіть час як ГГ:ХХ (наприклад 07:30).');
      return;
    }
    await storage.setUser(telegramId, { morningTime: parsed });
    await telegram.sendMessage(chatId, `Час ранкового автопосту встановлено: ${parsed}.`, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (inputState?.state === 'awaiting_evening_time') {
    await state.clearInputState(chatId);
    const parsed = parseTime(text);
    if (!parsed) {
      await telegram.sendMessage(chatId, 'Невірний формат. Введіть час як ГГ:ХХ (наприклад 20:00).');
      return;
    }
    await storage.setUser(telegramId, { eveningTime: parsed });
    await telegram.sendMessage(chatId, `Час вечірнього автопосту встановлено: ${parsed}.`, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }

  await telegram.sendMessage(chatId, 'Оберіть пункт у меню нижче або натисніть /start.', { reply_markup: telegram.buildMainKeyboard() });
}

async function actionWeather(chatId, telegramId) {
  const user = await storage.getUser(telegramId);
  if (user.lat == null || user.lon == null) {
    await telegram.sendMessage(chatId, 'Спочатку вкажіть місто в «📍 Місто».', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  let w;
  try {
    w = await weather.getOneCall(user.lat, user.lon);
  } catch (e) {
    await telegram.sendMessage(chatId, 'Не вдалося отримати погоду. Спробуйте пізніше.');
    return;
  }
  if (user.timezoneOffsetSeconds == null && w.timezoneOffsetSeconds != null) {
    await storage.setUser(telegramId, { timezoneOffsetSeconds: w.timezoneOffsetSeconds });
  }
  const offset = user.timezoneOffsetSeconds ?? w.timezoneOffsetSeconds ?? 0;
  const local = weather.getLocalTimeStrings(offset);
  const text = format.formatWeather(w, user.cityDisplay, local.time);
  await telegram.sendMessage(chatId, text, { reply_markup: telegram.buildMainKeyboard() });
}

async function getWeatherContext(user) {
  const w = await weather.getOneCall(user.lat, user.lon);
  const offset = user.timezoneOffsetSeconds ?? w.timezoneOffsetSeconds ?? 0;
  const local = weather.getLocalTimeStrings(offset);
  if (user.timezoneOffsetSeconds == null && w.timezoneOffsetSeconds != null) {
    await storage.setUser(user.telegramId || user.telegram_id, { timezoneOffsetSeconds: w.timezoneOffsetSeconds });
  }
  return {
    ...w,
    cityDisplay: user.cityDisplay,
    city: user.city,
    localTime: local.time,
    localDate: local.date,
  };
}

async function actionOutfit(chatId, telegramId) {
  const user = await storage.getUser(telegramId);
  if (user.lat == null || user.lon == null) {
    await telegram.sendMessage(chatId, 'Спочатку вкажіть місто в «📍 Місто».', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  let ctx;
  try {
    ctx = await getWeatherContext({ ...user, telegramId });
  } catch (e) {
    await telegram.sendMessage(chatId, 'Не вдалося отримати погоду. Спробуйте пізніше.');
    return;
  }
  const pl = format.profileLabel(user.profile);
  let result;
  if (ai.isAiAvailable()) {
    try {
      result = await ai.getOutfitAdvice(ctx, pl);
    } catch (_) {
      result = fallback.getFallbackOutfit(ctx, user.profile);
    }
  } else {
    result = fallback.getFallbackOutfit(ctx, user.profile);
  }
  const text = format.formatAdvice(result.bullets, result.explanation, pl);
  await telegram.sendMessage(chatId, text, { reply_markup: telegram.buildMainKeyboard() });
}

async function actionExplain(chatId, telegramId) {
  const user = await storage.getUser(telegramId);
  if (user.lat == null || user.lon == null) {
    await telegram.sendMessage(chatId, 'Спочатку вкажіть місто в «📍 Місто».', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  let ctx;
  try {
    ctx = await getWeatherContext({ ...user, telegramId });
  } catch (e) {
    await telegram.sendMessage(chatId, 'Не вдалося отримати погоду. Спробуйте пізніше.');
    return;
  }
  const pl = format.profileLabel(user.profile);
  let result;
  if (ai.isAiAvailable()) {
    try {
      result = await ai.getExplainAdvice(ctx, pl);
    } catch (_) {
      result = fallback.getFallbackExplain(ctx, user.profile);
    }
  } else {
    result = fallback.getFallbackExplain(ctx, user.profile);
  }
  const text = format.formatExplain(result.explanation || result.bullets.join(' '));
  await telegram.sendMessage(chatId, text, { reply_markup: telegram.buildMainKeyboard() });
}
