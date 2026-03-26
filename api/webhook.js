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
import * as analytics from '../lib/analytics.js';
import { PROFILES } from '../lib/storage.js';

const HELP_TEXT = `Формат міста: Місто, Країна. Погода — однією карткою. Поради щодо одягу — кнопка «Що вдягнути». В Налаштуваннях: місто, профіль, час нагадування.`;

const WEATHER_WAIT_MSG = 'Дзвоню на метеостанцію, зачекай хвильку ☎️';

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
  let skipDuplicateCheck = false;
  try {
    let lastId = await storage.getLastProcessedUpdateId();
    if (lastId > 900000000) {
      await storage.setLastProcessedUpdateId(0);
      lastId = 0;
    }
    if (updateId <= lastId) {
      res.status(200).json({ ok: true });
      return;
    }
  } catch (e) {
    console.error('Redis update_id:', e);
    skipDuplicateCheck = true;
    // Продовжуємо обробку, щоб бот хоча б відповів (без ідемпотентності)
  }

  try {
    const from = update.callback_query?.from ?? update.message?.from;
    if (from?.id != null && !from.is_bot) {
      await storage.mergeTelegramProfile(String(from.id), from);
    }
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
    // Завжди намагаємось зберегти update_id, щоб повторні запити (ретраї) не дублювали повідомлення
    try {
      await storage.setLastProcessedUpdateId(updateId);
    } catch (_) {}
  } catch (err) {
    console.error('Webhook handler:', err);
    const chatId = update.callback_query?.message?.chat?.id ?? update.message?.chat?.id;
    if (chatId) {
      try {
        await telegram.sendMessage(chatId, 'Виникла помилка. Спробуйте пізніше або /start.');
      } catch (e2) {
        console.error('Не вдалося надіслати повідомлення про помилку:', e2);
      }
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

  if (data === 'restart') {
    void analytics.recordEvent(telegramId, 'restart');
    await storage.clearUser(telegramId);
    await state.clearInputState(chatId);
    await state.setInputState(chatId, 'awaiting_city');
    const cityPrompt = 'Введіть місто (Місто, Країна) або натисніть кнопку й поділіться геолокацією.\n\nНаприклад: Тернопіль, Україна';
    await telegram.sendMessage(chatId, cityPrompt, { reply_markup: telegram.buildLocationRequestKeyboard() });
    return;
  }
  if (data === 'weather') {
    void analytics.recordEvent(telegramId, 'weather_now');
    await telegram.sendMessage(chatId, WEATHER_WAIT_MSG);
    await actionWeather(chatId, telegramId);
    return;
  }
  if (data === 'weather_later') {
    void analytics.recordEvent(telegramId, 'forecast_menu');
    await telegram.sendMessage(
      chatId,
      'Оберіть період прогнозу:',
      { reply_markup: telegram.buildWeatherLaterKeyboard() },
    );
    return;
  }
  if (data === 'weather_weekend' || data === 'weather_week' || data === 'weather_14days') {
    if (data === 'weather_weekend') void analytics.recordEvent(telegramId, 'forecast_weekend');
    else if (data === 'weather_week') void analytics.recordEvent(telegramId, 'forecast_week');
    else void analytics.recordEvent(telegramId, 'forecast_14d');
    const user = await storage.getUser(telegramId);
    if (user.lat == null || user.lon == null) {
      await telegram.sendMessage(chatId, 'Спочатку вкажіть місто: Налаштування → Місто.', { reply_markup: telegram.buildMainKeyboard() });
      return;
    }
    await telegram.sendMessage(chatId, WEATHER_WAIT_MSG);
    let forecastData;
    try {
      forecastData = await weather.getForecastDays(user.lat, user.lon);
    } catch (e) {
      await telegram.sendMessage(chatId, 'Зараз не можу завантажити прогноз. Спробуйте пізніше.', { reply_markup: telegram.buildMainKeyboard() });
      return;
    }
    const cityDisplay = user.cityDisplay || null;
    let text;
    if (data === 'weather_weekend') {
      const weekendDays = format.getWeekendDays(forecastData);
      if (weekendDays.length > 0 && ai.isAiAvailable()) {
        try {
          const dataText = format.formatWeekendDataForAi(weekendDays, cityDisplay);
          const aiText = await ai.getWeekendForecastSummary(dataText);
          if (aiText) {
            text = format.getWeekendForecastHeader(cityDisplay) + aiText;
          } else {
            text = format.formatForecastWeekend(forecastData, cityDisplay);
          }
        } catch (_) {
          text = format.formatForecastWeekend(forecastData, cityDisplay);
        }
      } else {
        text = format.formatForecastWeekend(forecastData, cityDisplay);
      }
    } else {
      text =
        data === 'weather_week'
          ? format.formatForecastWeek(forecastData, cityDisplay)
          : format.formatForecast14Days(forecastData, cityDisplay);
    }
    await telegram.sendLongMessage(chatId, text, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'outfit') {
    void analytics.recordEvent(telegramId, 'outfit_menu');
    const user = await storage.getUser(telegramId);
    const keyboard = {
      inline_keyboard: PROFILES.map(p => [
        { text: format.profileLabelOutfit(p) + (user.profile === p ? ' ✓' : ''), callback_data: `outfit:${p}` },
      ]),
    };
    await telegram.sendMessage(chatId, 'Куди збираєшся?', { reply_markup: keyboard });
    return;
  }
  if (data.startsWith('outfit:')) {
    const profile = data.replace('outfit:', '');
    if (PROFILES.includes(profile)) {
      await telegram.sendMessage(chatId, WEATHER_WAIT_MSG);
      await storage.setUser(telegramId, { profile });
      await actionOutfit(chatId, telegramId);
    }
    return;
  }
  if (data === 'profile') {
    void analytics.recordEvent(telegramId, 'profile_menu');
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
      void analytics.recordEvent(telegramId, 'profile_set');
      await storage.setUser(telegramId, { profile });
      await telegram.sendMessage(chatId, `Профіль змінено на «${format.profileLabel(profile)}».`, { reply_markup: telegram.buildMainKeyboard() });
    }
    return;
  }
  if (data === 'city') {
    void analytics.recordEvent(telegramId, 'city_flow_start');
    await state.setInputState(chatId, 'awaiting_city');
    const cityPrompt = 'Введіть місто у форматі Місто, Країна або натисніть кнопку й поділіться геолокацією.\n\nНаприклад: Тернопіль, Україна';
    await telegram.sendMessage(chatId, cityPrompt, { reply_markup: telegram.buildLocationRequestKeyboard() });
    return;
  }
  if (data === 'time_settings') {
    void analytics.recordEvent(telegramId, 'time_settings');
    const user = await storage.getUser(telegramId);
    const keyboard = {
      inline_keyboard: [
        [{ text: user.autopostMorning ? 'Ранок ВИМК' : 'Ранок УВІМК', callback_data: user.autopostMorning ? 'time_morning_off' : 'time_morning_on' }],
        [{ text: 'Час нагадування (07:30)', callback_data: 'time_set_morning' }],
        [{ text: '← Назад', callback_data: 'back_menu' }],
      ],
    };
    await telegram.sendMessage(chatId, format.formatTimeSettings(user), { reply_markup: keyboard });
    return;
  }
  if (data === 'time_morning_on') {
    void analytics.recordEvent(telegramId, 'autopost_on');
    await storage.setUser(telegramId, { autopostMorning: true });
    const user = await storage.getUser(telegramId);
    await telegram.sendMessage(chatId, 'Ранкове нагадування увімкнено о ' + (user.morningTime || '07:30') + ' за місцевим часом.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'time_morning_off') {
    void analytics.recordEvent(telegramId, 'autopost_off');
    await storage.setUser(telegramId, { autopostMorning: false });
    await telegram.sendMessage(chatId, 'Ранкове нагадування вимкнено.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  if (data === 'time_set_morning') {
    void analytics.recordEvent(telegramId, 'time_prompt');
    await state.setInputState(chatId, 'awaiting_morning_time');
    await telegram.sendMessage(chatId, 'Введіть час нагадування у форматі ГГ:ХХ (наприклад 07:30):');
    return;
  }
  if (data === 'settings') {
    void analytics.recordEvent(telegramId, 'settings_open');
    await telegram.sendMessage(chatId, '⚙ Налаштування:', { reply_markup: telegram.buildSettingsKeyboard() });
    return;
  }
  if (data === 'back_menu' || data === 'help') {
    if (data === 'help') {
      void analytics.recordEvent(telegramId, 'help_callback');
      await telegram.sendMessage(chatId, HELP_TEXT, { reply_markup: telegram.buildMainKeyboard() });
    } else {
      void analytics.recordEvent(telegramId, 'back_menu');
      await telegram.sendMessage(chatId, 'Оберіть:', { reply_markup: telegram.buildMainKeyboard() });
    }
    return;
  }
}

function normalizeOutfitTrigger(t) {
  return (t || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const text = (msg.text || '').trim();

  if (text === '/start') {
    void analytics.recordEvent(telegramId, 'start');
    const user = await storage.getUser(telegramId);
    if (user.lat != null && user.lon != null) {
      await telegram.sendMessage(chatId, 'Оберіть:', { reply_markup: telegram.buildMainKeyboard() });
      return;
    }
    await state.setInputState(chatId, 'awaiting_city');
    const cityPrompt = 'Привіт 👋\n\nВведіть місто (Місто, Країна) або натисніть кнопку й поділіться геолокацією.\n\nНаприклад: Тернопіль, Україна';
    await telegram.sendMessage(chatId, cityPrompt, { reply_markup: telegram.buildLocationRequestKeyboard() });
    return;
  }
  if (text === '/help') {
    void analytics.recordEvent(telegramId, 'help');
    await telegram.sendMessage(chatId, HELP_TEXT, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }

  const inputState = await state.getInputState(chatId);
  if (inputState?.state === 'awaiting_city') {
    await state.clearInputState(chatId);
    const location = msg.location;
    let geo = null;
    if (location?.latitude != null && location?.longitude != null) {
      try {
        geo = await weather.reverseGeocode(location.latitude, location.longitude);
      } catch (e) {
        await telegram.sendMessage(chatId, 'Зараз не можу визначити місто за координатами. Спробуйте ввести назву вручну.');
        return;
      }
      if (!geo) {
        await telegram.sendMessage(chatId, 'Не вдалося визначити місто за цими координатами. Введіть місто вручну (Місто, Країна).');
        return;
      }
    } else {
      if (!text) {
        await telegram.sendMessage(chatId, 'Місто не вказано. Введіть назву (Місто, Країна) або поділіться геолокацією.');
        return;
      }
      try {
        geo = await weather.geocode(text);
      } catch (e) {
        await telegram.sendMessage(chatId, 'Зараз не можу перевірити місто. Спробуйте пізніше.');
        return;
      }
      if (!geo) {
        await telegram.sendMessage(chatId, 'Не знайшов такого міста. Спробуйте ще раз у форматі «місто, країна».');
        return;
      }
    }
    await telegram.sendMessage(chatId, WEATHER_WAIT_MSG);
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
    void analytics.recordEvent(telegramId, 'city_set');
    let w;
    try {
      w = await weather.getOneCall(geo.lat, geo.lon);
    } catch (e) {
      await telegram.sendMessage(chatId, 'Зараз не можу отримати погоду. Спробуйте пізніше.', { reply_markup: telegram.buildMainKeyboard() });
      return;
    }
    const offset = timezoneOffsetSeconds ?? w.timezoneOffsetSeconds ?? 0;
    const local = weather.getLocalTimeStrings(offset);
    const weatherText = format.formatWeather(w, geo.displayName, local.time);
    await telegram.sendMessage(chatId, weatherText, { reply_markup: telegram.removeReplyKeyboard() });
    await telegram.sendMessage(chatId, 'Оберіть:', { reply_markup: telegram.buildMainKeyboard() });
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
    void analytics.recordEvent(telegramId, 'morning_time_set');
    await telegram.sendMessage(chatId, `Час нагадування встановлено: ${parsed}.`, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }

  if (text && normalizeOutfitTrigger(text) === 'що вдягнути') {
    void analytics.recordEvent(telegramId, 'outfit_trigger_text');
    const user = await storage.getUser(telegramId);
    if (user.lat == null || user.lon == null) {
      await telegram.sendMessage(chatId, 'Спочатку вкажіть місто: Налаштування → Місто або напишіть у форматі Місто, Країна.', { reply_markup: telegram.buildMainKeyboard() });
      return;
    }
    const keyboard = {
      inline_keyboard: PROFILES.map(p => [
        { text: format.profileLabelOutfit(p) + (user.profile === p ? ' ✓' : ''), callback_data: `outfit:${p}` },
      ]),
    };
    await telegram.sendMessage(chatId, 'Куди збираєшся?', { reply_markup: keyboard });
    return;
  }

  const user = await storage.getUser(telegramId);
  if ((user.lat == null || user.lon == null) && text) {
    let geo;
    try {
      geo = await weather.geocode(text);
    } catch (e) {
      await telegram.sendMessage(chatId, 'Зараз не можу перевірити місто. Спробуйте пізніше.');
      return;
    }
    if (!geo) {
      await telegram.sendMessage(chatId, 'Не знайшов такого міста. Спробуйте ще раз у форматі «місто, країна».');
      return;
    }
    await telegram.sendMessage(chatId, WEATHER_WAIT_MSG);
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
    void analytics.recordEvent(telegramId, 'city_text_weather');
    let w;
    try {
      w = await weather.getOneCall(geo.lat, geo.lon);
    } catch (e) {
      await telegram.sendMessage(chatId, 'Зараз не можу отримати погоду. Спробуйте пізніше.', { reply_markup: telegram.buildMainKeyboard() });
      return;
    }
    const offset = timezoneOffsetSeconds ?? w.timezoneOffsetSeconds ?? 0;
    const local = weather.getLocalTimeStrings(offset);
    const weatherText = format.formatWeather(w, geo.displayName, local.time);
    await telegram.sendMessage(chatId, weatherText, { reply_markup: telegram.buildMainKeyboard() });
    return;
  }

  await telegram.sendMessage(chatId, 'Не розумію. Оберіть кнопку в меню або /start.', { reply_markup: telegram.buildMainKeyboard() });
}

async function actionWeather(chatId, telegramId) {
  const user = await storage.getUser(telegramId);
  if (user.lat == null || user.lon == null) {
    await telegram.sendMessage(chatId, 'Спочатку вкажіть місто: Налаштування → Місто або напишіть у форматі Місто, Країна.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  let w;
  try {
    w = await weather.getOneCall(user.lat, user.lon);
  } catch (e) {
    await telegram.sendMessage(chatId, 'Зараз не можу отримати погоду. Спробуйте пізніше.');
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
    await telegram.sendMessage(chatId, 'Спочатку вкажіть місто: Налаштування → Місто або напишіть у форматі Місто, Країна.', { reply_markup: telegram.buildMainKeyboard() });
    return;
  }
  let ctx;
  try {
    ctx = await getWeatherContext({ ...user, telegramId });
  } catch (e) {
    await telegram.sendMessage(chatId, 'Зараз не можу отримати погоду. Спробуйте пізніше.');
    return;
  }
  const pl = format.profileLabel(user.profile);
  const ctxWithProfile = { ...ctx, profile: user.profile };
  let outfitResult;
  if (ai.isAiAvailable()) {
    try {
      outfitResult = await ai.getOutfitAdvice(ctxWithProfile, pl);
    } catch (_) {
      outfitResult = fallback.getFallbackOutfit(ctxWithProfile, user.profile);
    }
  } else {
    outfitResult = fallback.getFallbackOutfit(ctxWithProfile, user.profile);
  }
  const text = format.formatAdvice(outfitResult.bullets, outfitResult.explanation, pl);
  await telegram.sendMessage(chatId, text, { reply_markup: telegram.buildMainKeyboard() });
  void analytics.recordEvent(telegramId, 'outfit_advice');
}

