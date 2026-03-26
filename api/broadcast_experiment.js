/**
 * Одноразова розсилка про експеримент у «Погода на потім».
 * Запускається cron о 20:00 та 21:00 UTC — одна з подій потрапляє в 22:00 за Europe/Warsaw (літній/зимовий час).
 * У вікні 21:55–22:14 за Варшавою + dedup у Redis на календарний день (Варшава).
 *
 * Авторизація: Authorization: Bearer CRON_SECRET (як /api/tick).
 * Примусово (без перевірки часу): ?force=1 — лише якщо BROADCAST_EXPERIMENT_FORCE=1 у середовищі.
 */

import * as storage from '../lib/storage.js';
import * as telegram from '../lib/telegram.js';

const BROADCAST_MSG = `Привіт 👋

У розділі <b>Погода на потім</b> з’явилася <b>експериментальна функція</b> — <b>Коли нарешті потепліє?</b> 🌡

Загляньте в меню: короткий огляд за денним прогнозом (це не «магія точності», але підказує, коли можуть бути м’якші дні).

Дякуємо, що користуєте ботом 🙏`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Дата YYYY-MM-DD у календарі Варшави. */
function warsawCalendarDate(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(d);
}

/** Година та хвилина на годиннику у Варшаві (0–23, 0–59). */
function warsawHoursMinutes(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hours: get('hour'), minutes: get('minute') };
}

/** Вікно «приблизно 22:00» за Варшавою (cron приходить на :00 UTC-годину). */
function isWarsawFeatureBroadcastWindow(d = new Date()) {
  const { hours, minutes } = warsawHoursMinutes(d);
  if (hours === 21 && minutes >= 55) return true;
  if (hours === 22 && minutes <= 14) return true;
  return false;
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

  const force =
    req.query?.force === '1' &&
    process.env.BROADCAST_EXPERIMENT_FORCE === '1';

  if (!force && !isWarsawFeatureBroadcastWindow()) {
    res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'not_warsaw_22_window',
      warsaw: warsawHoursMinutes(),
      date: warsawCalendarDate(),
    });
    return;
  }

  const ymd = warsawCalendarDate();
  const lockKey = `broadcast:experiment_pogoda_napotim:${ymd}`;
  const claimed = await storage.tryClaimBroadcastLock(lockKey, 172800);
  if (!claimed) {
    res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'already_sent_today_warsaw',
      date: ymd,
    });
    return;
  }

  let ok = 0;
  let fail = 0;
  try {
    const ids = await storage.getAllUserIds();
    for (const chatId of ids) {
      try {
        await telegram.sendMessage(chatId, BROADCAST_MSG, {
          reply_markup: telegram.buildMainKeyboard(),
        });
        ok++;
      } catch (e) {
        fail++;
        console.error('broadcast_experiment', chatId, e.message || e);
      }
      await sleep(150);
    }
    res.status(200).json({
      ok: true,
      sent: ok,
      errors: fail,
      total: ids.length,
      warsawDate: ymd,
      force,
    });
  } catch (e) {
    console.error('broadcast_experiment', e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
