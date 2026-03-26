/**
 * Агрегована аналітика в Redis (Upstash): події, DAU за днями, знімок для дашборду.
 */

import crypto from 'crypto';
import { redis, getAllUserIds, getUser } from './storage.js';

const EVENTS_HASH = 'stats:events';
const TOTAL_KEY = 'stats:total_events';
const DAU_PREFIX = 'stats:dau:';
const DAU_TTL_SEC = 86400 * 120;

/** Зафіксувати дію (не блокує бота при помилці Redis). */
export async function recordEvent(telegramId, event) {
  if (!telegramId || !event) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    await Promise.all([
      redis('HINCRBY', EVENTS_HASH, event, 1),
      redis('INCR', TOTAL_KEY),
      redis('SADD', `${DAU_PREFIX}${day}`, String(telegramId)),
      redis('EXPIRE', `${DAU_PREFIX}${day}`, DAU_TTL_SEC),
    ]);
  } catch (e) {
    console.error('analytics recordEvent', event, e);
  }
}

function parseHgetall(result) {
  const out = {};
  if (!result) return out;
  if (typeof result === 'object' && !Array.isArray(result)) {
    for (const [k, v] of Object.entries(result)) out[k] = String(v);
    return out;
  }
  if (!Array.isArray(result)) return out;
  for (let i = 0; i < result.length; i += 2) {
    const k = result[i];
    const v = result[i + 1];
    if (k != null) out[String(k)] = v;
  }
  return out;
}

/** Перевірка пароля дашборду (заголовок X-Dashboard-Key). */
export function dashboardAuthOk(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || typeof expected !== 'string') return false;
  const got = req.headers['x-dashboard-key'];
  if (!got || typeof got !== 'string') return false;
  const ea = Buffer.from(expected, 'utf8');
  const ga = Buffer.from(got, 'utf8');
  if (ea.length !== ga.length) return false;
  try {
    return crypto.timingSafeEqual(ea, ga);
  } catch {
    return false;
  }
}

export async function getDashboardSnapshot() {
  const ids = await getAllUserIds();
  const users = await Promise.all(ids.map((id) => getUser(id)));
  let withLocation = 0;
  let withName = 0;
  const profileCounts = {};
  let autopostMorning = 0;
  for (const u of users) {
    if (u.lat != null && u.lon != null) withLocation++;
    if (u.autopostMorning) autopostMorning++;
    if (u.firstName) withName++;
    const p = u.profile || 'office';
    profileCounts[p] = (profileCounts[p] || 0) + 1;
  }

  const userRows = ids
    .map((id, i) => {
      const u = users[i];
      const parts = [u.firstName, u.lastName].filter(Boolean);
      const displayName = parts.length ? parts.join(' ') : null;
      return {
        telegramId: id,
        displayName,
        tgUsername: u.tgUsername || null,
        cityDisplay: u.cityDisplay || null,
        profile: u.profile || 'office',
        autopostMorning: !!u.autopostMorning,
        hasLocation: u.lat != null && u.lon != null,
      };
    })
    .sort((a, b) => {
      const an = (a.displayName || '\uffff').toLowerCase();
      const bn = (b.displayName || '\uffff').toLowerCase();
      if (an !== bn) return an.localeCompare(bn, 'uk');
      return String(a.telegramId).localeCompare(String(b.telegramId));
    });

  let rawEvents = {};
  let totalEvents = '0';
  let dauByDay = {};
  try {
    const h = await redis('HGETALL', EVENTS_HASH);
    rawEvents = parseHgetall(h);
    const t = await redis('GET', TOTAL_KEY);
    totalEvents = t != null ? String(t) : '0';
    const keys = await redis('KEYS', `${DAU_PREFIX}*`);
    if (keys && Array.isArray(keys) && keys.length) {
      const cards = await Promise.all(
        keys.map(async (k) => {
          const n = await redis('SCARD', k);
          const day = String(k).replace(DAU_PREFIX, '');
          return { day, n: Number(n) || 0 };
        }),
      );
      for (const { day, n } of cards) dauByDay[day] = n;
    }
  } catch (e) {
    console.error('getDashboardSnapshot redis', e);
  }

  const dauSorted = Object.entries(dauByDay)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);

  return {
    generatedAt: new Date().toISOString(),
    totalUsers: ids.length,
    usersWithLocation: withLocation,
    usersWithName: withName,
    autopostMorningUsers: autopostMorning,
    profileCounts,
    userRows,
    totalEvents: Number(totalEvents) || 0,
    events: rawEvents,
    dauLast30Days: dauSorted,
  };
}
