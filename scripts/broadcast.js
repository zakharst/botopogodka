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

const DEFAULT_MSG = `Привіт 👋 Вийшла версія 1.3 — ось що змінилося:

• Меню спрощене: Погода, Що вдягнути, Налаштування. Місто тепер у Налаштуваннях.
• «Що вдягнути» — одна дружня відповідь (порада + коротко про погоду), нагадуємо про парасольку та крем від сонця, коли треба.
• «Куди збираєшся?» — обираєте: В офіс, На прогулянку, Побігати, На велосипеді тощо.
• В Налаштуваннях є «Почати спочатку» — можна скинути місто та дані і почати з чистого аркуша.
• Точніші поради під погоду (температура, дощ, UV) і під активність (біг, велосипед).

Можете натиснути /start або Налаштування → Почати спочатку. Дякуємо, що користуєтесь ботом 🙏`;

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
