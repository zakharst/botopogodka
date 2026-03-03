/**
 * Cron endpoint — викликається кожні 5 хвилин (UTC).
 * Для кожного користувача з увімкненими автопостами обчислює локальний час міста
 * і відправляє ранкове/вечірнє повідомлення, якщо поточний локальний час потрапляє у вікно ±5 хв.
 */

import * as storage from '../lib/storage.js';
import * as telegram from '../lib/telegram.js';
import * as weather from '../lib/weather.js';
import * as format from '../lib/format.js';
import * as ai from '../lib/ai.js';
import * as fallback from '../lib/fallback_advice.js';

const WINDOW_MINUTES = 5;

function timeInWindow(nowHours, nowMinutes, targetTime) {
  const [th, tm] = targetTime.split(':').map(Number);
  const nowM = nowHours * 60 + nowMinutes;
  const targetM = th * 60 + tm;
  const diff = Math.abs(nowM - targetM);
  return diff <= WINDOW_MINUTES;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  const auth = req.headers.authorization || req.query?.cron_secret || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}` && auth !== cronSecret) {
    res.status(401).json({ ok: false });
    return;
  }

  let sent = 0;
  let errors = 0;
  try {
    const users = await storage.getAllUsersWithAutopost();
    for (const user of users) {
      const offset = user.timezoneOffsetSeconds;
      if (offset == null) {
        try {
          const w = await weather.getOneCall(user.lat, user.lon);
          const newOffset = w.timezoneOffsetSeconds;
          await storage.setUser(user.telegramId, { timezoneOffsetSeconds: newOffset });
          user.timezoneOffsetSeconds = newOffset;
        } catch (_) {
          errors++;
          continue;
        }
      }
      const local = weather.getLocalTimeStrings(user.timezoneOffsetSeconds || 0);
      const today = local.date;

      if (user.autopostMorning && timeInWindow(local.hours, local.minutes, user.morningTime || '07:30')) {
        if (user.lastSentMorningDate !== today) {
          try {
            await sendAutopost(user, 'morning');
            await storage.setUser(user.telegramId, { lastSentMorningDate: today });
            sent++;
          } catch (e) {
            console.error('tick morning', user.telegramId, e);
            errors++;
          }
        }
      }

      if (user.autopostEvening && timeInWindow(local.hours, local.minutes, user.eveningTime || '20:00')) {
        if (user.lastSentEveningDate !== today) {
          try {
            await sendAutopost(user, 'evening');
            await storage.setUser(user.telegramId, { lastSentEveningDate: today });
            sent++;
          } catch (e) {
            console.error('tick evening', user.telegramId, e);
            errors++;
          }
        }
      }
    }
  } catch (e) {
    console.error('tick', e);
    res.status(500).json({ ok: false, error: String(e.message) });
    return;
  }
  res.status(200).json({ ok: true, sent, errors });
}

async function sendAutopost(user, type) {
  let ctx;
  try {
    ctx = await weather.getOneCall(user.lat, user.lon);
  } catch (e) {
    await telegram.sendMessage(user.telegramId, 'Не вдалося отримати погоду для автопосту. Спробуйте пізніше.');
    return;
  }
  const offset = user.timezoneOffsetSeconds ?? ctx.timezoneOffsetSeconds ?? 0;
  const local = weather.getLocalTimeStrings(offset);
  if (user.timezoneOffsetSeconds == null && ctx.timezoneOffsetSeconds != null) {
    await storage.setUser(user.telegramId, { timezoneOffsetSeconds: ctx.timezoneOffsetSeconds });
  }

  const greeting = type === 'morning' ? 'Доброго ранку!' : 'Добрий вечір!';
  const weatherText = format.formatWeather(ctx, user.cityDisplay, local.time);

  const context = {
    ...ctx,
    cityDisplay: user.cityDisplay,
    city: user.city,
    localTime: local.time,
  };
  const pl = format.profileLabel(user.profile);
  let advice;
  if (ai.isAiAvailable()) {
    try {
      advice = await ai.getOutfitAdvice(context, pl);
    } catch (_) {
      advice = fallback.getFallbackOutfit(ctx, user.profile);
    }
  } else {
    advice = fallback.getFallbackOutfit(ctx, user.profile);
  }
  const adviceText = format.formatAdvice(advice.bullets, advice.explanation, pl);

  const full = `${greeting}\n\n${weatherText}\n\n${adviceText}`;
  await telegram.sendMessage(user.telegramId, full);
}
