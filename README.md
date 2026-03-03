# Ботопогодка — Telegram-бот «Погода + що вдягнути»

Продакшн-готовий бот з профілями, AI-порадами та автопостами за локальним часом міста. Деплой на Vercel.

## Зміст

1. [Як створити бота (BotFather) і взяти токен](#1-як-створити-бота-botfather)
2. [Як отримати OpenWeather API key](#2-openweather-api-key)
3. [One Call та Geocoding — які endpoint-и](#3-openweather-endpoint-и)
4. [Upstash Redis — REST URL/TOKEN](#4-upstash-redis)
5. [Деплой на Vercel](#5-деплой-на-vercel)
6. [Webhook — точний URL](#6-webhook)
7. [Локальне тестування](#7-локальне-тестування)
8. [Локальний час міста і cron 5 хв](#8-локальний-час-міста-і-cron)
9. [Увімкнення AI та фолбек](#9-ai-та-фолбек)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Як створити бота (BotFather)

1. Відкрийте Telegram, знайдіть **@BotFather**.
2. Надішліть `/newbot`.
3. Введіть ім'я бота (наприклад «Погодка») та username (наприклад `my_weather_ua_bot`).
4. BotFather надішле **токен** виду `7123456789:AAH...`. Збережіть його — це `TELEGRAM_TOKEN`.

---

## 2. OpenWeather API key

1. Зареєструйтесь на [openweathermap.org](https://openweathermap.org).
2. Перейдіть у [API keys](https://home.openweathermap.org/api_keys).
3. Створіть ключ — це `OPENWEATHER_API_KEY`.
4. Для **One Call API 3.0** потрібен підписний план (у т.ч. безкоштовний). На [One Call 3.0](https://openweathermap.org/api/one-call-3) підключіть необхідний план для вашого ключа.

---

## 3. OpenWeather endpoint-и

- **Geocoding** (пошук міста):  
  `GET https://api.openweathermap.org/geo/1.0/direct?q={місто, країна}&limit=5&appid={API_KEY}`  
  Відповідь: масив об’єктів з `lat`, `lon`, `name`, `country`.

- **One Call API 3.0** (погода + часовий пояс):  
  `GET https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&appid={API_KEY}&units=metric&lang=ua`  
  У відповіді: `timezone_offset` (секунди від UTC), `current`, `hourly`. Локальний час міста = UTC + `timezone_offset`. Час **не** береться з сервера й не фіксується як Europe/Warsaw.

---

## 4. Upstash Redis

1. Зареєструйтесь на [upstash.com](https://upstash.com).
2. Створіть базу Redis (регіон на вибір).
3. У панелі бази знайдіть **REST API**:
   - **UPSTASH_REDIS_REST_URL** — URL запитів.
   - **UPSTASH_REDIS_REST_TOKEN** — токен (пароль).

Якщо використовуєте Vercel KV — у проєкті Vercel підключіть KV і використовуйте змінні `KV_REST_API_URL` та `KV_REST_API_TOKEN` (код вже їх підтримує через fallback у `lib/storage.js`).

---

## 5. Деплой на Vercel

1. Пуште проєкт у GitHub (або підключіть інший Git).
2. На [vercel.com](https://vercel.com) → **Add New** → **Project** → імпортуйте репозиторій.
3. У **Settings → Environment Variables** додайте:

**Обов’язкові:**

| Змінна | Опис |
|--------|------|
| `TELEGRAM_TOKEN` | Токен від BotFather |
| `OPENWEATHER_API_KEY` | Ключ OpenWeather |
| `UPSTASH_REDIS_REST_URL` | URL Upstash Redis REST |
| `UPSTASH_REDIS_REST_TOKEN` | Токен Upstash Redis |

**Опційні:**

| Змінна | Опис |
|--------|------|
| `AI_PROVIDER` | `openai` або `gemini` або `none` |
| `AI_API_KEY` | Ключ API провайдера |
| `AI_MODEL` | Наприклад `gpt-4o-mini` або модель Gemini |
| `AI_BASE_URL` | Базовий URL (для OpenAI-сумісних API) |
| `CRON_SECRET` | Секрет для захисту `/api/tick` (рекомендовано) |

4. Деплой. Vercel сам налаштує cron для `/api/tick` з `vercel.json` (кожні 5 хвилин).

---

## 6. Webhook

Після деплою встановіть webhook (один раз), підставивши свій домен і токен:

```text
https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<ВАШ_ДОМЕН>/api/webhook
```

Приклад для домену `botopogodka.vercel.app`:

```text
https://api.telegram.org/bot7123456789:AAH.../setWebhook?url=https://botopogodka.vercel.app/api/webhook
```

Відкрийте цей URL у браузері або викличте через `curl`. У відповіді має бути `"ok":true`.

Перевірити webhook:

```text
https://api.telegram.org/bot<TELEGRAM_TOKEN>/getWebhookInfo
```

---

## 7. Локальне тестування

1. Встановіть [ngrok](https://ngrok.com): `ngrok http 3000`.
2. У проєкті: `npm i` (якщо потрібно), потім `npx vercel dev` — сервер на порту 3000.
3. Встановіть webhook на ngrok-URL:  
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://XXXX.ngrok.io/api/webhook`
4. Пишіть боту в Telegram — оновлення підуть на ваш комп через ngrok.

Альтернатива: деплой на Vercel (Preview) і тимчасово вказати webhook на preview-URL.

---

## 8. Локальний час міста і cron

- **Час міста** береться з OpenWeather: у відповіді One Call є `timezone_offset` (секунди від UTC). Локальний час = UTC + цей offset. Ні Europe/Warsaw, ні час сервера не використовуються.
- **Автопости**: кожен користувач має своє місто та збережений offset. Ранок (наприклад 07:30) і вечір (20:00) — це **локальний час цього міста**.
- **Cron кожні 5 хвилин**: на Vercel немає постійного процесу. Функція `/api/tick` викликається кожні 5 хв (UTC). У кожному запуску для кожного користувача обчислюється його локальний час; якщо він потрапляє у вікно ±5 хв від заданого часу і сьогодні ще не надсилали — відправляється повідомлення. Так досягається «07:30 у його місті» без постійного сервера.

---

## 9. AI та фолбек

- **Увімкнення AI**: встановіть `AI_PROVIDER=openai` (або `gemini`), `AI_API_KEY`, при потребі `AI_MODEL` та `AI_BASE_URL`. Тоді «Що вдягнути» та «Пояснення» генеруються через LLM.
- **Якщо AI вимкнений** (`AI_PROVIDER=none` або ключа немає) або сталася помилка/таймаут — використовується детермінований rule-based фолбек українською з `lib/fallback_advice.js`.

---

## 10. Troubleshooting

| Проблема | Що перевірити |
|----------|----------------|
| Бот не відповідає | Webhook встановлений на правильний URL (`/api/webhook`). `getWebhookInfo` — чи немає помилок. |
| 401 від Telegram | Правильність `TELEGRAM_TOKEN`, без зайвих пробілів. |
| No updates | Webhook вказує на HTTPS. Якщо змінили URL — викликати `setWebhook` знову. |
| Invalid city | Формат «місто, країна»; OpenWeather Geocoding повертає результат; ключ має доступ до Geocoding. |
| Помилки погоди | Підключений One Call 3.0 для ключа; у запиті передаються `lat`, `lon` з Geocoding. |
| Redis помилки | `UPSTASH_REDIS_REST_URL` та `UPSTASH_REDIS_REST_TOKEN` задані; мережа Vercel має доступ до Upstash. |
| Cron не спрацьовує | У Vercel у проєкті вкладка **Crons**: чи активний cron для `/api/tick`. Якщо використовуєте `CRON_SECRET` — Vercel сам додає заголовок; для ручного виклику передайте секрет у `Authorization: Bearer <CRON_SECRET>`. |

---

## Структура проєкту

- `api/webhook.js` — обробка оновлень Telegram (webhook).
- `api/tick.js` — cron кожні 5 хв, автопости за локальним часом.
- `lib/weather.js` — Geocoding + One Call, нормалізація, локальний час.
- `lib/telegram.js` — відправка повідомлень, клавіатури, setWebhook.
- `lib/storage.js` — Upstash Redis (користувачі, налаштування).
- `lib/state.js` — тимчасові стани введення (місто, час).
- `lib/ai.js` — AI-провайдер (OpenAI/Gemini), кеш 30 хв, таймаут 8 с.
- `lib/fallback_advice.js` — rule-based поради без AI.
- `lib/format.js` — форматування текстів українською.
- `vercel.json` — маршрути та cron.

Мова інтерфейсу та порад — українська.
