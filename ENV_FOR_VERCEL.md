# Змінні для Vercel

Додай ці змінні в проєкт на Vercel: **Settings** → **Environment Variables**. Для кожної вкажи **Name** і **Value**, середовище — **Production** (і за бажанням Preview).

| Name | Value | Обов'язково |
|------|--------|-------------|
| `TELEGRAM_TOKEN` | токен від @BotFather | так |
| `OPENWEATHER_API_KEY` | ключ з openweathermap.org | так |
| `UPSTASH_REDIS_REST_URL` | URL з Upstash Redis | так |
| `UPSTASH_REDIS_REST_TOKEN` | токен з Upstash Redis | так |
| `AI_PROVIDER` | `openai` | для AI-порад |
| `AI_API_KEY` | ключ OpenAI (sk-...) | для AI-порад |
| `AI_MODEL` | `gpt-4o-mini` | для AI-порад |

Після зміни змінних зроби **Redeploy** проєкту.
