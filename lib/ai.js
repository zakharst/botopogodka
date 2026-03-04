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

Тон: дружній, ввічливий, трохи розмовний — але спокійний і без драми. Використовуй «раджу», «варто» тощо.

Відповідь обовʼязково будуй суто на погодних даних з повідомлення користувача (температура, відчувається як, опис погоди, pop, UV, вітер). Не вигадуй умов — тільки те, що в повідомленні. Комбінуй фактори логічно (наприклад дощ + сонце, холод + вітер).

${guidelines}

Формат відповіді: 1) одне-два короткі речення інтерпретації погоди; 2) практичні поради буллетами (емодзі: 🧥 👕 👟 ☔); 3) за потреби — нюанси. Коротко, зрозуміло.`;
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
  m += `Профіль: ${profileLabel}.\n`;
  m += `Погода: ${desc}, температура ${temp}°C (відчувається ${feels}°C), вітер ${wind} м/с, вологість ${hum}%${pressure != null ? `, тиск ${pressure} мм рт. ст.` : ''}${uviText ? `, UV: ${uvi} (${uviText})` : ''}.\n`;
  m += `Ймовірність опадів у найближчі 12 год: до ${pop}%.\n\n`;
  if (type === 'outfit') m += 'Що вдягнути та чи брати парасольку/вітерозахис?';
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
    temperature: 0.5,
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
      temperature: 0.5,
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
