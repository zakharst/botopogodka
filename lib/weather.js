/**
 * Погода: підтримка WeatherAPI.com (безкоштовно 100K/міс) та OpenWeather (fallback).
 * Єдиний контракт: geocode(query), getOneCall(lat, lon), getLocalTimeStrings(offset).
 */

const WEATHERAPI_KEY = process.env.WEATHERAPI_API_KEY;
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;

const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const GEO_REVERSE_URL = 'https://api.openweathermap.org/geo/1.0/reverse';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const API_KEY = OPENWEATHER_KEY;

/** Часовий пояс України: літо (DST) UTC+3, зима UTC+2 (секунди) */
function getUkraineTimezoneOffset() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const octLast = new Date(Date.UTC(year, 9, 31));
  let lastSunMarch = marchLast;
  while (lastSunMarch.getUTCDay() !== 0) lastSunMarch.setUTCDate(lastSunMarch.getUTCDate() - 1);
  let lastSunOct = octLast;
  while (lastSunOct.getUTCDay() !== 0) lastSunOct.setUTCDate(lastSunOct.getUTCDate() - 1);
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (d >= lastSunMarch.getTime() && d < lastSunOct.getTime()) return 10800;
  return 7200;
}

const WEATHERAPI_BASE = 'https://api.weatherapi.com/v1';

/** Кеш погоди (10 хв) */
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map();

function cacheKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function useWeatherApi() {
  return !!WEATHERAPI_KEY;
}

/** Часовий пояс (секунди від UTC) з IANA tz_id */
function getTimezoneOffsetSeconds(tzId) {
  if (!tzId) return 0;
  try {
    const s = new Intl.DateTimeFormat('en', { timeZone: tzId, timeZoneName: 'longOffset' }).format(new Date());
    const m = s.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    const h = parseInt(m[2], 10);
    const min = parseInt(m[3] || '0', 10);
    return sign * (h * 3600 + min * 60);
  } catch {
    return 0;
  }
}

/** Парс "6:45 AM" / "4:30 PM" у години та хвилини (24h) */
function parseTime12(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return { h, min };
}

/** Сьогодні (дата YYYY-MM-DD) + час у заданому tz → Unix UTC */
function localToUnixUtc(dateStr, hour, min, offsetSeconds) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour, min, 0) - offsetSeconds * 1000;
  return Math.floor(utcMs / 1000);
}

if (!WEATHERAPI_KEY && !API_KEY) {
  console.warn('WEATHERAPI_API_KEY або OPENWEATHER_API_KEY не задано');
}

/** Латиниця для поширених українських міст (якщо кириличний пошук не знайшов) */
const UA_CITY_LATIN = {
  тернопіль: 'Ternopil, UA',
  київ: 'Kyiv, UA',
  киев: 'Kyiv, UA',
  харків: 'Kharkiv, UA',
  харьков: 'Kharkiv, UA',
  одеса: 'Odesa, UA',
  одесса: 'Odesa, UA',
  львів: 'Lviv, UA',
  львов: 'Lviv, UA',
  дніпро: 'Dnipro, UA',
  днепр: 'Dnipro, UA',
  запоріжжя: 'Zaporizhzhia, UA',
  запорожье: 'Zaporizhzhia, UA',
  'івано-франківськ': 'Ivano-Frankivsk, UA',
  'івано-франковськ': 'Ivano-Frankivsk, UA',
  чернігів: 'Chernihiv, UA',
  чернигов: 'Chernihiv, UA',
  черкаси: 'Cherkasy, UA',
  винниця: 'Vinnytsia, UA',
  вінниця: 'Vinnytsia, UA',
  житомир: 'Zhytomyr, UA',
  ужгород: 'Uzhhorod, UA',
  луцьк: 'Lutsk, UA',
  луцк: 'Lutsk, UA',
  рівне: 'Rivne, UA',
  ровно: 'Rivne, UA',
  полтава: 'Poltava, UA',
  суми: 'Sumy, UA',
  херсон: 'Kherson, UA',
  миколаїв: 'Mykolaiv, UA',
  николаев: 'Mykolaiv, UA',
  кривий: 'Kryvyi Rih, UA',
  кривой: 'Kryvyi Rih, UA',
  маріуполь: 'Mariupol, UA',
  мариуполь: 'Mariupol, UA',
};

/** Резерв: координати українських міст, якщо API не відповідає (lat, lon, displayName) */
const UA_CITY_FALLBACK = {
  тернопіль: { lat: 49.5534, lon: 25.5892, name: 'Ternopil', country: 'UA', displayName: 'Тернопіль, Україна' },
  київ: { lat: 50.4501, lon: 30.5234, name: 'Kyiv', country: 'UA', displayName: 'Київ, Україна' },
  киев: { lat: 50.4501, lon: 30.5234, name: 'Kyiv', country: 'UA', displayName: 'Київ, Україна' },
  харків: { lat: 49.9935, lon: 36.2304, name: 'Kharkiv', country: 'UA', displayName: 'Харків, Україна' },
  харьков: { lat: 49.9935, lon: 36.2304, name: 'Kharkiv', country: 'UA', displayName: 'Харків, Україна' },
  одеса: { lat: 46.4825, lon: 30.7233, name: 'Odesa', country: 'UA', displayName: 'Одеса, Україна' },
  одесса: { lat: 46.4825, lon: 30.7233, name: 'Odesa', country: 'UA', displayName: 'Одеса, Україна' },
  львів: { lat: 49.8397, lon: 24.0297, name: 'Lviv', country: 'UA', displayName: 'Львів, Україна' },
  львов: { lat: 49.8397, lon: 24.0297, name: 'Lviv', country: 'UA', displayName: 'Львів, Україна' },
  дніпро: { lat: 48.4647, lon: 35.0462, name: 'Dnipro', country: 'UA', displayName: 'Дніпро, Україна' },
  днепр: { lat: 48.4647, lon: 35.0462, name: 'Dnipro', country: 'UA', displayName: 'Дніпро, Україна' },
  запоріжжя: { lat: 47.8388, lon: 35.1396, name: 'Zaporizhzhia', country: 'UA', displayName: 'Запоріжжя, Україна' },
  запорожье: { lat: 47.8388, lon: 35.1396, name: 'Zaporizhzhia', country: 'UA', displayName: 'Запоріжжя, Україна' },
  чернігів: { lat: 51.4982, lon: 31.2893, name: 'Chernihiv', country: 'UA', displayName: 'Чернігів, Україна' },
  чернигов: { lat: 51.4982, lon: 31.2893, name: 'Chernihiv', country: 'UA', displayName: 'Чернігів, Україна' },
  черкаси: { lat: 49.4444, lon: 32.0598, name: 'Cherkasy', country: 'UA', displayName: 'Черкаси, Україна' },
  винниця: { lat: 49.2328, lon: 28.4681, name: 'Vinnytsia', country: 'UA', displayName: 'Вінниця, Україна' },
  вінниця: { lat: 49.2328, lon: 28.4681, name: 'Vinnytsia', country: 'UA', displayName: 'Вінниця, Україна' },
  житомир: { lat: 50.2547, lon: 28.6587, name: 'Zhytomyr', country: 'UA', displayName: 'Житомир, Україна' },
  ужгород: { lat: 48.6240, lon: 22.2952, name: 'Uzhhorod', country: 'UA', displayName: 'Ужгород, Україна' },
  луцьк: { lat: 50.7472, lon: 25.3254, name: 'Lutsk', country: 'UA', displayName: 'Луцьк, Україна' },
  луцк: { lat: 50.7472, lon: 25.3254, name: 'Lutsk', country: 'UA', displayName: 'Луцьк, Україна' },
  рівне: { lat: 50.6199, lon: 26.2516, name: 'Rivne', country: 'UA', displayName: 'Рівне, Україна' },
  ровно: { lat: 50.6199, lon: 26.2516, name: 'Rivne', country: 'UA', displayName: 'Рівне, Україна' },
  полтава: { lat: 49.5883, lon: 34.5514, name: 'Poltava', country: 'UA', displayName: 'Полтава, Україна' },
  суми: { lat: 50.9077, lon: 34.7981, name: 'Sumy', country: 'UA', displayName: 'Суми, Україна' },
  херсон: { lat: 46.6354, lon: 32.6169, name: 'Kherson', country: 'UA', displayName: 'Херсон, Україна' },
  миколаїв: { lat: 46.9750, lon: 31.9946, name: 'Mykolaiv', country: 'UA', displayName: 'Миколаїв, Україна' },
  николаев: { lat: 46.9750, lon: 31.9946, name: 'Mykolaiv', country: 'UA', displayName: 'Миколаїв, Україна' },
};

async function geocodeWeatherApi(query) {
  if (!WEATHERAPI_KEY || !query?.trim()) return null;
  const q = encodeURIComponent(query.trim());
  const res = await fetch(`${WEATHERAPI_BASE}/search.json?key=${WEATHERAPI_KEY}&q=${q}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return {
    name: first.name,
    country: first.country,
    state: first.region || '',
    lat: first.lat,
    lon: first.lon,
    displayName: [first.name, first.country].filter(Boolean).join(', '),
  };
}

async function geocodeOpenWeatherOne(query) {
  if (!query || !query.trim() || !API_KEY) return null;
  const q = encodeURIComponent(query.trim());
  const url = `${GEO_URL}?q=${q}&limit=5&appid=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return {
    name: first.name,
    country: first.country,
    state: first.state || '',
    lat: first.lat,
    lon: first.lon,
    displayName: [first.name, first.country].filter(Boolean).join(', '),
  };
}

/** Зворотний геокод: координати → назва міста (для кнопки «Поділитися геолокацією»). */
async function reverseGeocodeOpenWeather(lat, lon) {
  if (!API_KEY) return null;
  const res = await fetch(`${GEO_REVERSE_URL}?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return {
    name: first.name,
    country: first.country,
    state: first.state || '',
    lat: first.lat,
    lon: first.lon,
    displayName: [first.name, first.country].filter(Boolean).join(', '),
  };
}

export async function reverseGeocode(lat, lon) {
  if (!WEATHERAPI_KEY && !API_KEY) throw new Error('WEATHERAPI_API_KEY або OPENWEATHER_API_KEY не налаштовано');
  if (WEATHERAPI_KEY) {
    try {
      const geo = await geocodeWeatherApi(`${lat},${lon}`);
      if (geo) return geo;
    } catch (_) {}
  }
  return await reverseGeocodeOpenWeather(lat, lon);
}

export async function geocode(query) {
  if (!WEATHERAPI_KEY && !API_KEY) throw new Error('WEATHERAPI_API_KEY або OPENWEATHER_API_KEY не налаштовано');
  const trimmed = query.trim();
  const cityPart = trimmed.toLowerCase().replace(/\s+/g, ' ').split(',')[0].trim();

  const tryWeatherApi = async (q) => {
    if (!WEATHERAPI_KEY) return null;
    try {
      return await geocodeWeatherApi(q);
    } catch {
      return null;
    }
  };
  const tryOpenWeather = async (q) => {
    if (!API_KEY) return null;
    return await geocodeOpenWeatherOne(q);
  };

  let geo = null;
  if (WEATHERAPI_KEY) {
    geo = await tryWeatherApi(trimmed);
    if (!geo && API_KEY) geo = await tryOpenWeather(trimmed);
  } else {
    geo = await tryOpenWeather(trimmed);
  }
  if (geo) return geo;

  if (/україна|ukraine|украина/i.test(trimmed) && !trimmed.includes(', UA')) {
    const withUA = trimmed.replace(/\s*,\s*(україна|ukraine|украина)\s*$/i, ', UA');
    geo = (WEATHERAPI_KEY && (await tryWeatherApi(withUA))) || (API_KEY && (await tryOpenWeather(withUA)));
    if (geo) return geo;
  }
  for (const [cyr, latinQuery] of Object.entries(UA_CITY_LATIN)) {
    if (cityPart.includes(cyr)) {
      geo = (WEATHERAPI_KEY && (await tryWeatherApi(latinQuery))) || (API_KEY && (await tryOpenWeather(latinQuery)));
      if (geo) return geo;
      break;
    }
  }
  for (const [cyr, fallback] of Object.entries(UA_CITY_FALLBACK)) {
    if (cityPart.includes(cyr)) {
      return {
        name: fallback.name,
        country: fallback.country,
        state: '',
        lat: fallback.lat,
        lon: fallback.lon,
        displayName: fallback.displayName,
      };
    }
  }
  return null;
}

async function getOneCallWeatherApi(lat, lon) {
  if (!WEATHERAPI_KEY) throw new Error('WEATHERAPI_API_KEY не налаштовано');
  const q = `${lat},${lon}`;
  const res = await fetch(`${WEATHERAPI_BASE}/forecast.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(q)}&days=2&lang=uk`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WeatherAPI: ${res.status} ${t}`);
  }
  const raw = await res.json();
  return normalizeWeatherApiResponse(raw);
}

function normalizeWeatherApiResponse(data) {
  const loc = data.location || {};
  const cur = data.current || {};
  const day0 = data.forecast?.forecastday?.[0];
  const day = day0?.day || {};
  const astro = day0?.astro || {};
  const hours = day0?.hour || [];

  const tzId = loc.tz_id;
  const offsetSeconds = getTimezoneOffsetSeconds(tzId);

  let popMax = 0;
  const popNextHours = [];
  for (const h of hours) {
    const p = (h.chance_of_rain != null ? h.chance_of_rain : 0) / 100;
    popNextHours.push(p);
    if (p > popMax) popMax = p;
  }
  const dailyChance = day.daily_chance_of_rain != null ? day.daily_chance_of_rain / 100 : 0;
  if (dailyChance > popMax) popMax = dailyChance;

  let sunrise = null;
  let sunset = null;
  const dateStr = day0?.date;
  const sunriseParsed = parseTime12(astro.sunrise);
  const sunsetParsed = parseTime12(astro.sunset);
  if (dateStr && sunriseParsed) sunrise = localToUnixUtc(dateStr, sunriseParsed.h, sunriseParsed.min, offsetSeconds);
  if (dateStr && sunsetParsed) sunset = localToUnixUtc(dateStr, sunsetParsed.h, sunsetParsed.min, offsetSeconds);

  let dayLengthMinutes = null;
  if (sunrise != null && sunset != null) dayLengthMinutes = Math.round((sunset - sunrise) / 60);

  const moonPhaseStr = astro.moon_phase;
  let moonPhase = null;
  const phaseMap = { 'New Moon': 0, 'Waxing Crescent': 0.12, 'First Quarter': 0.25, 'Waxing Gibbous': 0.37, 'Full Moon': 0.5, 'Waning Gibbous': 0.62, 'Last Quarter': 0.75, 'Waning Crescent': 0.88 };
  if (phaseMap[moonPhaseStr] != null) moonPhase = phaseMap[moonPhaseStr];
  let moonIllumination = astro.moon_illumination != null ? Math.round(Number(astro.moon_illumination)) : null;
  let daysToFullMoon = null;
  if (moonPhase != null) {
    if (moonPhase < 0.5) daysToFullMoon = Math.round((0.5 - moonPhase) * 29.53);
    else if (moonPhase > 0.5) daysToFullMoon = Math.round((1.5 - moonPhase) * 29.53);
  }

  const condition = cur.condition || {};
  const windMs = cur.wind_kph != null ? cur.wind_kph / 3.6 : 0;
  const pressureHpa = cur.pressure_mb != null ? cur.pressure_mb : null;

  return {
    timezoneOffsetSeconds: offsetSeconds,
    current: {
      temp: cur.temp_c != null ? cur.temp_c : null,
      feelsLike: cur.feelslike_c != null ? cur.feelslike_c : null,
      humidity: cur.humidity != null ? cur.humidity : null,
      windSpeed: windMs,
      pressure: pressureHpa,
      uvi: cur.uv != null ? cur.uv : (day.uv != null ? day.uv : null),
      weather: { description: condition.text || 'н/д', id: condition.code || 0 },
    },
    sunrise,
    sunset,
    dayLengthMinutes,
    moonPhase,
    moonIllumination,
    daysToFullMoon,
    tempMin: day.mintemp_c != null ? day.mintemp_c : cur.temp_c,
    tempMax: day.maxtemp_c != null ? day.maxtemp_c : cur.temp_c,
    hourly: hours.slice(0, 12).map(h => ({
      dt: h.time_epoch,
      temp: h.temp_c,
      pop: (h.chance_of_rain != null ? h.chance_of_rain : 0) / 100,
      weather: (h.condition && h.condition.text) ? h.condition.text : 'н/д',
    })),
    popMax,
    popNextHours,
  };
}

export async function getOneCall(lat, lon) {
  if (!WEATHERAPI_KEY && !API_KEY) throw new Error('WEATHERAPI_API_KEY або OPENWEATHER_API_KEY не налаштовано');
  const key = cacheKey(lat, lon);
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_CACHE_TTL_MS) return cached.data;

  let data;
  if (WEATHERAPI_KEY) {
    try {
      data = await getOneCallWeatherApi(lat, lon);
    } catch (e) {
      if (API_KEY) {
        const url = `${ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua`;
        const res = await fetch(url);
        data = res.ok ? normalizeOneCall(await res.json()) : await getOneCallFallback(lat, lon);
      } else {
        throw e;
      }
    }
  } else {
    const url = `${ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua`;
    const res = await fetch(url);
    data = res.ok ? normalizeOneCall(await res.json()) : await getOneCallFallback(lat, lon);
  }
  weatherCache.set(key, { data, at: Date.now() });
  return data;
}

const FORECAST_CACHE_TTL_MS = 30 * 60 * 1000;
const forecastCache = new Map();

/**
 * Прогноз з OpenWeather 2.5 /forecast (без One Call 3.0) — до ~5 днів, агрегація 3-годинних зрізів.
 */
async function getForecastDaysOpenWeather25(lat, lon) {
  if (!API_KEY) return null;
  const res = await fetch(`${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua`);
  if (!res.ok) return null;
  const data = await res.json();
  const list = data.list || [];
  const tz = data.city?.timezone ?? 0;
  if (!list.length) return null;
  const buckets = new Map();
  for (const item of list) {
    const dt = item.dt + tz;
    const dateObj = new Date(dt * 1000);
    const y = dateObj.getUTCFullYear();
    const mo = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const da = String(dateObj.getUTCDate()).padStart(2, '0');
    const keyDay = `${y}-${mo}-${da}`;
    const tmin = item.main?.temp_min ?? item.main?.temp;
    const tmax = item.main?.temp_max ?? item.main?.temp;
    const w = item.weather && item.weather[0];
    const desc = w ? w.description : 'н/д';
    const pop = item.pop != null ? item.pop : 0;
    if (!buckets.has(keyDay)) {
      buckets.set(keyDay, { date: keyDay, tempMin: tmin, tempMax: tmax, descriptions: [desc], pops: [pop] });
    } else {
      const b = buckets.get(keyDay);
      b.tempMin = Math.min(b.tempMin, tmin);
      b.tempMax = Math.max(b.tempMax, tmax);
      b.descriptions.push(desc);
      b.pops.push(pop);
    }
  }
  const days = Array.from(buckets.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      date: b.date,
      tempMin: b.tempMin != null ? Math.round(b.tempMin) : null,
      tempMax: b.tempMax != null ? Math.round(b.tempMax) : null,
      condition: b.descriptions[Math.floor(b.descriptions.length / 2)] || 'н/д',
      chanceOfRain: Math.round(Math.max(...b.pops, 0) * 100),
      windMaxMs: null,
      tempMorning: null,
      tempNoon: null,
      tempEvening: null,
    }));
  return { timezoneOffsetSeconds: tz, days };
}

function normalizeWeatherApiForecastPayload(data) {
  const tzId = data.location?.tz_id;
  const offsetSeconds = getTimezoneOffsetSeconds(tzId);
  const days = (data.forecast?.forecastday || []).map((fd) => {
    const day = fd.day || {};
    const cond = day.condition || {};
    const hours = fd.hour || [];
    const pickHour = (h) => {
      const pad = String(h).padStart(2, '0');
      const slot = hours.find((x) => {
        const t = x.time ? String(x.time) : '';
        return t.endsWith(` ${pad}:00`) || t.endsWith(` ${h}:00`);
      });
      return slot && slot.temp_c != null ? Math.round(slot.temp_c) : null;
    };
    const windKph = day.maxwind_kph != null ? day.maxwind_kph : null;
    return {
      date: fd.date,
      tempMin: day.mintemp_c != null ? Math.round(day.mintemp_c) : null,
      tempMax: day.maxtemp_c != null ? Math.round(day.maxtemp_c) : null,
      condition: cond.text || 'н/д',
      chanceOfRain: day.daily_chance_of_rain != null ? Math.round(day.daily_chance_of_rain) : 0,
      windMaxMs: windKph != null ? Math.round((windKph / 3.6) * 10) / 10 : null,
      tempMorning: pickHour(8),
      tempNoon: pickHour(12),
      tempEvening: pickHour(18),
    };
  });
  return { timezoneOffsetSeconds: offsetSeconds, days };
}

/** До 14 днів з WeatherAPI; при помилці — null (тоді пробуємо OpenWeather). */
async function tryGetForecastDaysWeatherApi(lat, lon) {
  if (!WEATHERAPI_KEY) return null;
  try {
    const q = `${lat},${lon}`;
    const res = await fetch(`${WEATHERAPI_BASE}/forecast.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(q)}&days=14&lang=uk`);
    if (!res.ok) {
      const t = await res.text();
      console.warn('WeatherAPI forecast:', res.status, t.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const result = normalizeWeatherApiForecastPayload(data);
    return result.days?.length ? result : null;
  } catch (e) {
    console.warn('WeatherAPI forecast:', e.message || e);
    return null;
  }
}

/** One Call 3.0 або агрегат 2.5 /forecast; null якщо нічого не вийшло. */
async function tryGetForecastDaysOpenWeather(lat, lon) {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua`);
    if (res.ok) {
      const data = await res.json();
      const timezoneOffsetSeconds = data.timezone_offset ?? 0;
      const daily = data.daily || [];
      const days = daily.slice(0, 14).map((d) => {
        const dt = d.dt != null ? d.dt + timezoneOffsetSeconds : 0;
        const dateObj = new Date(dt * 1000);
        const y = dateObj.getUTCFullYear();
        const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const dayStr = String(dateObj.getUTCDate()).padStart(2, '0');
        const date = `${y}-${m}-${dayStr}`;
        const w = d.weather && d.weather[0];
        const pop = d.pop != null ? Math.round(d.pop * 100) : 0;
        const windMs = d.wind_speed != null ? Math.round(d.wind_speed * 10) / 10 : null;
        return {
          date,
          tempMin: d.temp?.min != null ? Math.round(d.temp.min) : null,
          tempMax: d.temp?.max != null ? Math.round(d.temp.max) : null,
          condition: w ? w.description : 'н/д',
          chanceOfRain: pop,
          windMaxMs: windMs,
          tempMorning: null,
          tempNoon: null,
          tempEvening: null,
        };
      });
      return { timezoneOffsetSeconds, days };
    }
  } catch (e) {
    console.warn('OpenWeather One Call:', e.message || e);
  }
  return await getForecastDaysOpenWeather25(lat, lon);
}

/**
 * Об'єднати дні за датою (YYYY-MM-DD). WeatherAPI перекриває OpenWeather — кращий опис українською.
 * Потрібно, бо на free WeatherAPI лише ~3 дні, а OW 2.5 дає ще кілька днів уперед.
 */
function mergeForecastByDate(openWeatherResult, weatherApiResult) {
  const map = new Map();
  for (const d of openWeatherResult?.days || []) {
    if (d?.date) map.set(d.date, d);
  }
  for (const d of weatherApiResult?.days || []) {
    if (d?.date) map.set(d.date, d);
  }
  const days = [...map.keys()].sort().map((k) => map.get(k));
  const timezoneOffsetSeconds =
    weatherApiResult?.timezoneOffsetSeconds ?? openWeatherResult?.timezoneOffsetSeconds ?? 0;
  return { timezoneOffsetSeconds, days };
}

/** Прогноз на кілька днів: масив { date, tempMin, tempMax, condition, chanceOfRain }. */
export async function getForecastDays(lat, lon) {
  if (!WEATHERAPI_KEY && !API_KEY) {
    throw new Error('WEATHERAPI_API_KEY або OPENWEATHER_API_KEY не налаштовано');
  }
  const key = `forecast_${cacheKey(lat, lon)}`;
  const cached = forecastCache.get(key);
  if (cached && Date.now() - cached.at < FORECAST_CACHE_TTL_MS) return cached.data;

  let wResult = null;
  let oResult = null;
  if (WEATHERAPI_KEY && API_KEY) {
    [wResult, oResult] = await Promise.all([
      tryGetForecastDaysWeatherApi(lat, lon),
      tryGetForecastDaysOpenWeather(lat, lon),
    ]);
  } else if (WEATHERAPI_KEY) {
    wResult = await tryGetForecastDaysWeatherApi(lat, lon);
  } else {
    oResult = await tryGetForecastDaysOpenWeather(lat, lon);
  }

  let result = null;
  if (wResult?.days?.length && oResult?.days?.length) {
    result = mergeForecastByDate(oResult, wResult);
  } else if (wResult?.days?.length) {
    result = wResult;
  } else if (oResult?.days?.length) {
    result = oResult;
  }

  if (!result?.days?.length) {
    throw new Error('Не вдалося завантажити прогноз: ні WeatherAPI, ні OpenWeather не повернули дані.');
  }

  forecastCache.set(key, { data: result, at: Date.now() });
  return result;
}

/** Резерв через безкоштовні API: current + forecast (без One Call 3.0) */
async function getOneCallFallback(lat, lon) {
  const curUrl = `${CURRENT_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua`;
  const curRes = await fetch(curUrl);
  if (!curRes.ok) {
    const text = await curRes.text();
    throw new Error(`Weather: ${curRes.status} ${text}`);
  }
  const currentData = await curRes.json();

  let popMax = 0;
  const popNextHours = [];
  const forecastUrl = `${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua&cnt=16`;
  const foreRes = await fetch(forecastUrl);
  if (foreRes.ok) {
    const foreData = await foreRes.json();
    const list = foreData.list || [];
    for (const item of list) {
      const p = item.pop != null ? item.pop : 0;
      popNextHours.push(p);
      if (p > popMax) popMax = p;
    }
  }

  const w = currentData.weather && currentData.weather[0];
  const offset = getUkraineTimezoneOffset();
  const sunrise = currentData.sys?.sunrise ?? null;
  const sunset = currentData.sys?.sunset ?? null;
  let dayLengthMinutes = null;
  if (sunrise != null && sunset != null) dayLengthMinutes = Math.round((sunset - sunrise) / 60);

  return {
    timezoneOffsetSeconds: offset,
    current: {
      temp: currentData.main?.temp,
      feelsLike: currentData.main?.feels_like,
      humidity: currentData.main?.humidity,
      windSpeed: currentData.wind?.speed ?? 0,
      pressure: currentData.main?.pressure ?? null,
      uvi: null,
      weather: w ? { description: w.description, id: w.id } : { description: 'н/д', id: 0 },
    },
    sunrise,
    sunset,
    dayLengthMinutes,
    moonPhase: null,
    moonIllumination: null,
    daysToFullMoon: null,
    tempMin: currentData.main?.temp != null ? currentData.main.temp : null,
    tempMax: currentData.main?.temp != null ? currentData.main.temp : null,
    hourly: [],
    popMax,
    popNextHours,
  };
}

function normalizeOneCall(data) {
  const current = data.current || {};
  const daily = data.daily && data.daily[0];
  const hourly = (data.hourly || []).slice(0, 12);
  const timezoneOffsetSeconds = data.timezone_offset ?? 0;

  let popMax = 0;
  let popNextHours = [];
  for (const h of hourly) {
    const p = h.pop != null ? h.pop : 0;
    popNextHours.push(p);
    if (p > popMax) popMax = p;
  }

  const sunrise = daily?.sunrise ?? current.sunrise ?? null;
  const sunset = daily?.sunset ?? current.sunset ?? null;
  let dayLengthMinutes = null;
  if (sunrise != null && sunset != null) dayLengthMinutes = Math.round((sunset - sunrise) / 60);

  const moonPhase = daily?.moon_phase ?? current.moon_phase ?? null;
  let moonIllumination = null;
  let daysToFullMoon = null;
  if (moonPhase != null) {
    moonIllumination = Math.round(Math.sin(moonPhase * Math.PI) * 100);
    if (moonPhase < 0.5) daysToFullMoon = Math.round((0.5 - moonPhase) * 29.53);
    else if (moonPhase > 0.5) daysToFullMoon = Math.round((1.5 - moonPhase) * 29.53);
  }

  return {
    timezoneOffsetSeconds,
    current: {
      temp: current.temp,
      feelsLike: current.feels_like,
      humidity: current.humidity,
      windSpeed: current.wind_speed,
      pressure: current.pressure ?? null,
      uvi: current.uvi ?? daily?.uvi ?? null,
      weather: (current.weather && current.weather[0]) ? {
        description: current.weather[0].description,
        id: current.weather[0].id,
      } : { description: 'н/д', id: 0 },
    },
    sunrise,
    sunset,
    dayLengthMinutes,
    moonPhase,
    moonIllumination,
    daysToFullMoon,
    tempMin: daily?.temp?.min ?? current.temp ?? null,
    tempMax: daily?.temp?.max ?? current.temp ?? null,
    hourly: hourly.map(h => ({
      dt: h.dt,
      temp: h.temp,
      pop: h.pop != null ? h.pop : 0,
      weather: (h.weather && h.weather[0]) ? h.weather[0].description : 'н/д',
    })),
    popMax,
    popNextHours,
  };
}

/**
 * Обчислити поточний локальний час міста (рядок YYYY-MM-DD та HH:mm).
 */
export function getLocalTimeStrings(timezoneOffsetSeconds) {
  const now = Date.now();
  const offsetMs = (timezoneOffsetSeconds || 0) * 1000;
  const localMs = now + offsetMs;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    date: `${y}-${m}-${day}`,
    time: `${h}:${min}`,
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}
