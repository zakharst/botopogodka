# Куди вписати ключі

Нижче — що саме потрібно отримати і куди вставити (локально в `.env` або на Vercel у **Settings → Environment Variables**).

---

## 1. Telegram (бот)

| Що | Де взяти | Куди вписати |
|----|----------|--------------|
| **TELEGRAM_TOKEN** | Telegram → @BotFather → `/newbot` → скопіювати токен | `TELEGRAM_TOKEN=7123456789:AAH...` |

---

## 2. OpenWeather

| Що | Де взяти | Куди вписати |
|----|----------|--------------|
| **OPENWEATHER_API_KEY** | [openweathermap.org](https://openweathermap.org) → Sign In → [API keys](https://home.openweathermap.org/api_keys) → Create key | `OPENWEATHER_API_KEY=abc123...` |

Один раз підключіть **One Call API 3.0** для цього ключа: [One Call 3.0](https://openweathermap.org/api/one-call-3) → Subscribe (є безкоштовний план).

---

## 3. Upstash Redis

| Що | Де взяти | Куди вписати |
|----|----------|--------------|
| **UPSTASH_REDIS_REST_URL** | [console.upstash.com](https://console.upstash.com) → Create DB → вкладка **REST API** → **UPSTASH_REDIS_REST_URL** | `UPSTASH_REDIS_REST_URL=https://xxx.upstash.io` |
| **UPSTASH_REDIS_REST_TOKEN** | Там само → **UPSTASH_REDIS_REST_TOKEN** | `UPSTASH_REDIS_REST_TOKEN=AXyz...` |

---

## 4. AI (опційно)

Якщо хочете «Що вдягнути» та «Пояснення» через AI:

| Що | Де взяти | Куди вписати |
|----|----------|--------------|
| **AI_PROVIDER** | — | `openai` або `gemini` |
| **AI_API_KEY** | OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) або Gemini: [aistudio.google.com](https://aistudio.google.com/app/apikey) | `AI_API_KEY=sk-...` або ключ Gemini |
| **AI_MODEL** | — | Наприклад `gpt-4o-mini` (OpenAI) або `gemini-1.5-flash` (Gemini) |
| **AI_BASE_URL** | Тільки якщо використовуєте інший API (не api.openai.com) | Опційно |

Якщо не вписувати — працюватиме rule-based фолбек українською.

---

## 5. Захист cron (опційно)

| Що | Де взяти | Куди вписати |
|----|----------|--------------|
| **CRON_SECRET** | Придумати довільний рядок (наприклад згенерувати пароль) | `CRON_SECRET=mySecret123` |

Якщо вписати — Vercel буде підставляти його при виклику `/api/tick`; без нього endpoint відкритий (але викликається лише по крону).

---

## Де саме вписувати

- **Локально (для `vercel dev` / тестів):** скопіюй `.env.example` у `.env` і заповни значення. Файл `.env` не комітиться в git.
- **На Vercel (продакшн):** у проєкті Vercel → **Settings** → **Environment Variables** → додай кожну змінну (Name = ключ, Value = значення), потім зроби **Redeploy**.

Після заповнення обовʼязкових (Telegram, OpenWeather, Upstash) можна деплоїти і виставляти webhook.
