/**
 * OpenWeather: Geocoding + One Call API.
 * Час міста — з timezone_offset у відповіді (секунди від UTC).
 */

const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const API_KEY = process.env.OPENWEATHER_API_KEY;

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

/** Кеш погоди (10 хв), щоб не витрачати ліміт безкоштовного API */
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map();

function cacheKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

if (!API_KEY) {
  console.warn('OPENWEATHER_API_KEY не задано');
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

async function geocodeOne(query) {
  if (!query || !query.trim()) return null;
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

export async function geocode(query) {
  if (!API_KEY) throw new Error('OPENWEATHER_API_KEY не налаштовано');
  const trimmed = query.trim();
  let geo = await geocodeOne(trimmed);
  if (geo) return geo;
  // Спробувати з кодом країни UA замість "Україна"
  if (/україна|ukraine|украина/i.test(trimmed) && !trimmed.includes(', UA')) {
    const withUA = trimmed.replace(/\s*,\s*(україна|ukraine|украина)\s*$/i, ', UA');
    geo = await geocodeOne(withUA);
    if (geo) return geo;
  }
  // Для українських міст — спробувати латинський варіант через API
  const cityPart = trimmed.toLowerCase().replace(/\s+/g, ' ').split(',')[0].trim();
  for (const [cyr, latinQuery] of Object.entries(UA_CITY_LATIN)) {
    if (cityPart.includes(cyr)) {
      geo = await geocodeOne(latinQuery);
      if (geo) return geo;
      break;
    }
  }
  // Якщо API не дав результату — використати жорстко задані координати
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

export async function getOneCall(lat, lon) {
  if (!API_KEY) throw new Error('OPENWEATHER_API_KEY не налаштовано');
  const key = cacheKey(lat, lon);
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_CACHE_TTL_MS) return cached.data;

  const url = `${ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ua`;
  const res = await fetch(url);
  let data;
  if (res.ok) {
    data = normalizeOneCall(await res.json());
  } else {
    data = await getOneCallFallback(lat, lon);
  }
  weatherCache.set(key, { data, at: Date.now() });
  return data;
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
