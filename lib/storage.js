/**
 * Персистентне сховище через Upstash Redis REST API.
 * Ключі: user:{telegramId}, last_update_id (глобальний для ідемпотентності).
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const DEFAULT_USER = {
  firstName: null,
  lastName: null,
  tgUsername: null,
  city: null,
  cityDisplay: null,
  lat: null,
  lon: null,
  timezoneOffsetSeconds: null,
  profile: 'office',
  autopostMorning: false,
  autopostEvening: false,
  morningTime: '07:30',
  eveningTime: '20:00',
  lastSentMorningDate: null,
  lastSentEveningDate: null,
};

const PROFILES = ['office', 'walk', 'run', 'car', 'baby', 'bike'];

export async function redis(command, ...args) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL та UPSTASH_REDIS_REST_TOKEN обовʼязкові');
  }
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Redis: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.result;
}

function userKey(telegramId) {
  return `user:${telegramId}`;
}

export async function getUser(telegramId) {
  const raw = await redis('GET', userKey(telegramId));
  if (!raw) return { ...DEFAULT_USER };
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_USER, ...parsed };
    if (merged.profile === 'moto') merged.profile = 'bike';
    return merged;
  } catch {
    return { ...DEFAULT_USER };
  }
}

export async function setUser(telegramId, data) {
  const current = await getUser(telegramId);
  const merged = { ...current, ...data };
  await redis('SET', userKey(telegramId), JSON.stringify(merged));
  return merged;
}

/**
 * Оновити з Telegram User (ім'я, @username). Викликати з message.from / callback_query.from.
 */
export async function mergeTelegramProfile(telegramId, from) {
  if (!from || from.is_bot || telegramId == null) return;
  const patch = {};
  const fn = from.first_name != null ? String(from.first_name).trim().slice(0, 200) : '';
  patch.firstName = fn || null;
  if ('last_name' in from) {
    const ln = from.last_name != null ? String(from.last_name).trim().slice(0, 200) : '';
    patch.lastName = ln || null;
  }
  if ('username' in from) {
    const u = from.username != null ? String(from.username).replace(/^@/, '').trim().slice(0, 64) : '';
    patch.tgUsername = u || null;
  }
  await setUser(telegramId, patch);
}

/** Повністю скинути дані користувача (рестарт — як вперше). */
export async function clearUser(telegramId) {
  await redis('SET', userKey(telegramId), JSON.stringify({ ...DEFAULT_USER }));
  return { ...DEFAULT_USER };
}

/** Усі telegram ID, що колись запускали бота (мають запис user:*). */
export async function getAllUserIds() {
  const keys = await redis('KEYS', 'user:*');
  if (!keys || !keys.length) return [];
  return keys.map(k => k.replace('user:', ''));
}

export async function getAllUsersWithAutopost() {
  const keys = await redis('KEYS', 'user:*');
  if (!keys || !keys.length) return [];
  const users = [];
  for (const key of keys) {
    const raw = await redis('GET', key);
    if (!raw) continue;
    try {
      const u = JSON.parse(raw);
      const id = key.replace('user:', '');
      if (u.autopostMorning) {
        if (u.lat != null && u.lon != null) {
          users.push({ telegramId: id, ...u });
        }
      }
    } catch {
      // skip
    }
  }
  return users;
}

export async function getLastProcessedUpdateId() {
  const v = await redis('GET', 'last_update_id');
  return v != null ? Number(v) : 0;
}

export async function setLastProcessedUpdateId(id) {
  await redis('SET', 'last_update_id', String(id));
}

export { PROFILES, DEFAULT_USER };
