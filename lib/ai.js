/**
 * AI-провайдер-агностичний модуль. Чистий HTTPS fetch.
 * Підтримка: openai, gemini (через REST). Таймаут 8 с, кеш 30 хв.
 */

import { getGuidelinesTextForPrompt } from './advice_guidelines.js';

const PROVIDER = process.env.AI_PROVIDER || 'none';
const API_KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const BASE_URL = process.env.AI_BASE_URL || '';
const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map();

function cacheKey(input) {
  const str = JSON.stringify({
    city: input.city,
    profile: input.profile,
    temp: input.temp != null ? Math.round(input.temp) : null,
    feelsLike: input.feelsLike != null ? Math.round(input.feelsLike) : null,
    pop: input.popMax != null ? Math.round(input.popMax * 100) : null,
    wind: input.windSpeed != null ? Math.round(input.windSpeed * 10) : null,
    type: input.adviceType,
  });
  return str;
}

export function isAiAvailable() {
  return PROVIDER !== 'none' && !!API_KEY;
}

export async function getOutfitAdvice(weatherContext, profileLabel) {
  const key = cacheKey({ ...weatherContext, adviceType: 'outfit' });
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const value = await callProvider('outfit', weatherContext, profileLabel, controller.signal);
    cache.set(key, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getExplainAdvice(weatherContext, profileLabel) {
  const key = cacheKey({ ...weatherContext, adviceType: 'explain' });
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const value = await callProvider('explain', weatherContext, profileLabel, controller.signal);
    cache.set(key, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

/** Дружній прогноз на вихідні згенерований AI. userMessageText — дані від formatWeekendDataForAi. */
export async function getWeekendForecastSummary(userMessageText, signal) {
  if (!isAiAvailable()) return null;
  const controller = signal ? null : new AbortController();
  const sig = signal || controller.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const systemPrompt = buildSystemPrompt('weekend_forecast');
    if (PROVIDER === 'openai') {
      const base = BASE_URL || 'https://api.openai.com/v1';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageText },
          ],
          max_tokens: 420,
          temperature: 0.6,
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }
    if (PROVIDER === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessageText}` }] }],
          generationConfig: { maxOutputTokens: 420, temperature: 0.6 },
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Дружній коментар «коли потепліє» за денними даними (userMessageText — від formatWarmWindowDataForAi). */
export async function getWarmWhenNarrative(userMessageText, signal) {
  if (!isAiAvailable() || !userMessageText?.trim()) return null;
  const controller = signal ? null : new AbortController();
  const sig = signal || controller.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const systemPrompt = buildSystemPrompt('warm_when');
    if (PROVIDER === 'openai') {
      const base = BASE_URL || 'https://api.openai.com/v1';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageText },
          ],
          max_tokens: 450,
          temperature: 0.65,
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }
    if (PROVIDER === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessageText}` }] }],
          generationConfig: { maxOutputTokens: 450, temperature: 0.65 },
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Огляд тижня / двох тижнів за таблицею днів (userMessageText — від buildForecastPeriodStructured.dataForAi). */
export async function getPeriodForecastNarrative(userMessageText, signal) {
  if (!isAiAvailable() || !userMessageText?.trim()) return null;
  const controller = signal ? null : new AbortController();
  const sig = signal || controller.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const systemPrompt = buildSystemPrompt('period_forecast');
    if (PROVIDER === 'openai') {
      const base = BASE_URL || 'https://api.openai.com/v1';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageText },
          ],
          max_tokens: 400,
          temperature: 0.62,
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }
    if (PROVIDER === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessageText}` }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.62 },
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** 2–4 речення «як зараз на вулиці» за даними поточної погоди. */
export async function getCurrentWeatherNarrative(userMessageText, signal) {
  if (!isAiAvailable() || !userMessageText?.trim()) return null;
  const controller = signal ? null : new AbortController();
  const sig = signal || controller.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const systemPrompt = buildSystemPrompt('current_weather_blurb');
    if (PROVIDER === 'openai') {
      const base = BASE_URL || 'https://api.openai.com/v1';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageText },
          ],
          max_tokens: 180,
          temperature: 0.58,
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.choices?.[0]?.message?.content || '').trim();
    }
    if (PROVIDER === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessageText}` }] }],
          generationConfig: { maxOutputTokens: 180, temperature: 0.58 },
        }),
        signal: sig,
      });
      if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function callProvider(type, ctx, profileLabel, signal) {
  if (PROVIDER === 'openai') return callOpenAi(type, ctx, profileLabel, signal);
  if (PROVIDER === 'gemini') return callGemini(type, ctx, profileLabel, signal);
  throw new Error('AI провайдер не налаштований');
}

function buildSystemPrompt(type) {
  const base = `Ти допомагаєш з побутовими порадами щодо погоди та одягу. Мова відповіді — лише українська.
Не давай медичних чи лікувальних порад. Тільки рекомендації: що вдягнути, чи брати парасольку, чи вітер сильний тощо.`;
  if (type === 'outfit') {
    const guidelines = getGuidelinesTextForPrompt();
    return `${base}

Критично: пораду маєш щоразу продумувати з нуля з конкретних цифр і умов з повідомлення (температура, відчувається як, вітер, pop, UV, опис погоди, обрана активність). Не підбирай з «словника» готових фраз — ні для одягу, ні для взуття, ні для парасольки. Подумай: при цих градусах і вітрі що реально буде комфортно? чи сандалі при +7 розумні? чи варто згадувати парасольку при 0% опадів? Формулюй по-своєму кожного разу.

Тон: як у друга в чаті — природно, тепло. Без шаблонів типу «парасольку брати не потрібно», «насолоджуйтесь». Про парасольку — тільки якщо реально очікуються опади; інакше не згадувати зовсім. UV і вітер — лише коли справді доречно.

Логіка (орієнтуйся, але не копіюй формулювання):
${guidelines}

Профіль активності враховуй по-справжньому: офіс / прогулянка / біг / велосипед / з дитиною / за кермом — це змінює, що радити.

Формат: 2–4 речення про погоду і відчуття (своїми словами), потім перехід і буллети що вдягнути (емодзі 🧥 👕 👟, ☔ лише при дощі). Без заголовків і однакових закінчень.`;
  }
  if (type === 'weekend_forecast') {
    return `Ти допомагаєш з прогнозом погоди. Мова відповіді — лише українська.
Завдання: на основі даних про вихідні (субота та неділя) напиши теплий, живий прогноз на 2 абзаци — по одному на кожен день. Пиши природно, як у спільному чаті: температура від такої вночі до такої вдень, умови, чи буде дощ, вітер. Додай короткий «настрій» дня (наприклад, чи варто гуляти, чи краще з парасолькою) — ще 1–2 речення загалом, без пафосу й без штампів. Не використовуй крапки-роздільники (·), не пиши у вигляді списків з буллетами. По 2–3 речення на день — нормально.`;
  }
  if (type === 'period_forecast') {
    return `Ти допомагаєш з прогнозом погоди. Мова відповіді — лише українська.
У повідомленні користувача — таблиця днів (7 або 14): дати, мінімум і максимум температури, умови, ймовірність дощу.

Напиши змістовний огляд на 5–8 речень: загальний настрій періоду, чи є тренд на потепління чи похолодання, чи варто чекати дощових днів підряд, де «вікно» з відносно сухою чи приємною погодою — усе тільки з наданих дат і чисел, нічого не вигадуй. Тон як у друга в чаті, без канцеляриту. Не згадуй API, моделі й технічні сервіси. Без HTML і без markdown; можна два абзаци через порожній рядок. Не переписуй таблицю дослівно — інтерпретуй її для людини.`;
  }
  if (type === 'current_weather_blurb') {
    return `Ти допомагаєш з погодою. Мова відповіді — лише українська.
Нижче — фактичні дані про погоду «зараз» у місті користувача.

Напиши 2–4 короткі речення: як це відчувається на вулиці, на що звернути увагу (вітер, дощ, сонце), без повторення всіх цифр з рядка в рядок — головне враження. Не вигадуй чисел. Без HTML і markdown. Не згадуй назви API чи сервісів.`;
  }
  if (type === 'warm_when') {
    return `Ти допомагаєш з побутовим прогнозом. Мова відповіді — лише українська.
Користувач питає, коли нарешті стане тепліше; нижче в повідомленні — кілька днів з мінімумом і максимумом температури, умовами й ймовірністю дощу.

Напиши 2–4 абзаци (між абзацами — порожній рядок), загалом до ~10 речень: тепло й природно, ніби друг у чаті. Чи є помітніші тепліші дні, чи ще прохолодно, чи є передихання ближче до кінця періоду. Якщо тиждень суворий — чесно, без драми й без фраз «неможливо відповісти», «немає даних», «не можу». Не вигадуй дат і чисел — лише з наданих рядків. Не повторюй формулювання на кшталт «наступні N днів» чи «за 16 днів» — інтерфейс уже показує горизонт окремо. Не згадуй API чи моделі. Без HTML і без markdown. Не переписуй таблицю дослівно — інтерпретуй для людини.`;
  }
  return `${base}\n\nДай коротке пояснення (2-4 речення) українською, чому така погода і на що звернути увагу.`;
}

function buildUserMessage(type, ctx, profileLabel) {
  const w = ctx.current || {};
  const temp = w.temp != null ? Math.round(w.temp) : 'н/д';
  const feels = w.feelsLike != null ? Math.round(w.feelsLike) : 'н/д';
  const wind = w.windSpeed != null ? w.windSpeed : 0;
  const hum = w.humidity != null ? w.humidity : 'н/д';
  const pressure = w.pressure != null ? Math.round(w.pressure * 0.750062) : null;
  const pop = ctx.popMax != null ? Math.round(ctx.popMax * 100) : 0;
  const desc = (w.weather && w.weather.description) ? w.weather.description : 'н/д';
  const uvi = w.uvi != null ? Number(w.uvi) : null;
  const uviText = uvi != null ? (uvi < 3 ? 'низький' : uvi < 6 ? 'помірний' : 'високий') : null;

  let m = `Місто: ${ctx.cityDisplay || ctx.city || 'н/д'}. Локальний час: ${ctx.localTime || 'н/д'}.\n`;
  m += `Користувач обрав активність: ${profileLabel}. Порада має бути саме для цієї активності (не універсальна).\n`;
  m += `Погода: ${desc}, температура ${temp}°C (відчувається ${feels}°C), вітер ${wind} м/с, вологість ${hum}%${pressure != null ? `, тиск ${pressure} мм рт. ст.` : ''}${uviText ? `, UV: ${uvi} (${uviText})` : ''}.\n`;
  m += `Ймовірність опадів у найближчі 12 год: до ${pop}%.\n\n`;
  if (type === 'outfit') m += 'Що вдягнути для цієї активності та чи брати парасольку/вітерозахис?';
  else m += 'Коротко поясни погоду та на що звернути увагу.';
  return m;
}

async function callOpenAi(type, ctx, profileLabel, signal) {
  const base = BASE_URL || 'https://api.openai.com/v1';
  const url = `${base}/chat/completions`;
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(type) },
      { role: 'user', content: buildUserMessage(type, ctx, profileLabel) },
    ],
    max_tokens: 400,
    temperature: 0.65,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI: ${res.status} ${t}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  return parseAiResponse(content, type);
}

async function callGemini(type, ctx, profileLabel, signal) {
  const apiKey = API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const userContent = buildUserMessage(type, ctx, profileLabel);
  const systemContent = buildSystemPrompt(type);
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${systemContent}\n\n---\n\n${userContent}` }] }],
    generationConfig: {
      maxOutputTokens: 400,
      temperature: 0.65,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini: ${res.status} ${t}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return parseAiResponse(text, type);
}

function parseAiResponse(text, type) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = [];
  let explanation = '';
  for (const line of lines) {
    if (line.startsWith('•') || line.startsWith('-') || /^\d+[.)]/.test(line)) {
      bullets.push(line.replace(/^[•\-]\s*|\d+[.)]\s*/, '').trim());
    } else {
      explanation += (explanation ? ' ' : '') + line;
    }
  }
  if (!bullets.length && explanation) {
    bullets.push(explanation);
    explanation = '';
  }
  return { bullets: bullets.length ? bullets : ['Одягніться за погодою.'], explanation };
}
