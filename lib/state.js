/**
 * Тимчасові стани введення (місто, час). Ключ: chatId, значення: { state, data }.
 * Для serverless зберігаємо в Redis з TTL 10 хв.
 */

import * as storage from './storage.js';

const STATE_PREFIX = 'input_state:';
const TTL_SEC = 600;

async function stateKey(chatId) {
  return `${STATE_PREFIX}${chatId}`;
}

export async function getInputState(chatId) {
  const key = await stateKey(chatId);
  const raw = await storage.redis('GET', key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setInputState(chatId, state, data = {}) {
  const key = await stateKey(chatId);
  await storage.redis('SET', key, JSON.stringify({ state, data }));
  await storage.redis('EXPIRE', key, TTL_SEC);
}

export async function clearInputState(chatId) {
  const key = await stateKey(chatId);
  await storage.redis('DEL', key);
}
