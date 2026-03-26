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

const DEFAULT_MSG = `Привіт 👋

У розділі <b>Погода на потім</b> з’явилася <b>експериментальна функція</b> — <b>Коли нарешті потепліє?</b> 🌡

Загляньте в меню: короткий огляд за денним прогнозом (це не «магія точності», але підказує, коли можуть бути м’якші дні).

Дякуємо, що користуєте ботом 🙏`;

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
      await telegram.sendMessage(chatId, msg, { reply_markup: telegram.buildMainKeyboard() });
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
