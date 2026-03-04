#!/usr/bin/env node
/**
 * Розсилка одного повідомлення всім користувачам бота.
 *
 * Запуск (з кореня проєкту):
 *   node scripts/broadcast.js
 *   BROADCAST_MSG="Привіт! Нова версія. Можете почати з /start" node scripts/broadcast.js
 *
 * Потрібні змінні: TELEGRAM_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * Можна підставити через .env або: node --env-file=.env scripts/broadcast.js
 */

import * as storage from '../lib/storage.js';
import * as telegram from '../lib/telegram.js';

const DEFAULT_MSG = `Привіт 👋 Вийшла версія 1.4 — ось що нового:

• Погода на потім: з'явилась кнопка — можна подивитися прогноз на вихідні, на тиждень або на 2 тижні.
• Вихідні описуємо по-людськи: температура вночі та вдень, чи буде дощ, вітер.
• Місто можна вказати двома способами: написати назву (Місто, Країна) або поділитися геолокацією — бот сам визначить місто.
• Заголовок погоди: поточна температура зараз і назви міст у правильному відмінку (у Варшаві, в Тернополі).
• Поради «Що вдягнути» стали природнішими: AI продумує рекомендації з погоди, взуття підбираємо під температуру.

Дякуємо, що користуєтесь ботом 🙏 Можете натиснути /start або «Оберіть», щоб побачити меню.`;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const msg = process.env.BROADCAST_MSG || DEFAULT_MSG;
  console.log('Отримую список користувачів...');
  const ids = await storage.getAllUserIds();
  console.log('Знайдено користувачів:', ids.length);
  if (ids.length === 0) {
    console.log('Нікого відправляти.');
    return;
  }
  let ok = 0;
  let fail = 0;
  for (const chatId of ids) {
    try {
      await telegram.sendMessage(chatId, msg);
      ok++;
      process.stdout.write(`\rВідправлено ${ok}/${ids.length}`);
    } catch (e) {
      fail++;
      console.error(`\nПомилка для ${chatId}:`, e.message || e);
    }
    await sleep(150);
  }
  console.log(`\nГотово. Успішно: ${ok}, помилок: ${fail}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
