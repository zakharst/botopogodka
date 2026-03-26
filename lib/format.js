/**
 * Форматування повідомлень українською.
 */

import { getLocalTimeStrings } from './weather.js';

/** Місцевий відмінок (у/в кого? де?) для назв міст. Ключ — нормалізована назва (lowercase, без країни). */
const CITY_LOCATIVE = {
  warsaw: 'Варшаві',
  варшава: 'Варшаві',
  ternopil: 'Тернополі',
  тернопіль: 'Тернополі',
  kyiv: 'Києві',
  київ: 'Києві',
  kharkiv: 'Харкові',
  харків: 'Харкові',
  odesa: 'Одесі',
  odessa: 'Одесі',
  одеса: 'Одесі',
  lviv: 'Львові',
  львів: 'Львові',
  dnipro: 'Дніпрі',
  дніпро: 'Дніпрі',
  zaporizhzhia: 'Запоріжжі',
  запоріжжя: 'Запоріжжі',
  chernihiv: 'Чернігові',
  чернігів: 'Чернігові',
  cherkasy: 'Черкасах',
  черкаси: 'Черкасах',
  vinnytsia: 'Вінниці',
  винниця: 'Вінниці',
  zhytomyr: 'Житомирі',
  житомир: 'Житомирі',
  uzhhorod: 'Ужгороді',
  ужгород: 'Ужгороді',
  lutsk: 'Луцьку',
  луцьк: 'Луцьку',
  rivne: 'Рівному',
  рівне: 'Рівному',
  poltava: 'Полтаві',
  полтава: 'Полтаві',
  sumy: 'Сумах',
  суми: 'Сумах',
  kherson: 'Херсоні',
  херсон: 'Херсоні',
  mykolaiv: 'Миколаєві',
  миколаїв: 'Миколаєві',
  'kryvyi rih': 'Кривому Розі',
  'кривий ріг': 'Кривому Розі',
  mariupol: 'Маріуполі',
  маріуполь: 'Маріуполі',
  'ivano-frankivsk': 'Івано-Франківську',
  'івано-франківськ': 'Івано-Франківську',
  krakow: 'Кракові',
  краків: 'Кракові',
  gdansk: 'Гданську',
  гданськ: 'Гданську',
  wroclaw: 'Вроцлаві',
  вроцлав: 'Вроцлаві',
  poznan: 'Познані',
  берлін: 'Берліні',
  berlin: 'Берліні',
  prague: 'Празі',
  прага: 'Празі',
  budapest: 'Будапешті',
  будапешт: 'Будапешті',
  bucharest: 'Бухаресті',
  бухарест: 'Бухаресті',
  chisinau: 'Кишиневі',
  кишинів: 'Кишиневі',
  minsk: 'Мінську',
  мінськ: 'Мінську',
  moscow: 'Москві',
  москва: 'Москві',
  vilnius: 'Вільнюсі',
  вільнюс: 'Вільнюсі',
  riga: 'Ризі',
  рига: 'Ризі',
  tallinn: 'Таллінні',
  таллинн: 'Таллінні',
};

/** Прийменник «у» перед приголосними, «в» перед голосними. */
function prepositionBefore(word) {
  if (!word || typeof word !== 'string') return 'у';
  const first = word.trim()[0];
  const vowels = 'аеиіоууюяєїАЕИІОУЮЯЄЇaeiouAEIOU';
  return vowels.includes(first) ? 'в' : 'у';
}

/**
 * Повертає місто в місцевому відмінку для фрази «У/В [місто] зараз».
 * Якщо міста немає в словнику — повертає null (використається вихідна назва).
 */
function cityDisplayToLocative(displayName) {
  if (!displayName || typeof displayName !== 'string') return null;
  const normalized = displayName
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const locative = CITY_LOCATIVE[normalized];
  if (locative) {
    const prep = prepositionBefore(locative);
    return `${prep} ${locative}`;
  }
  return null;
}

const PROFILE_NAMES = {
  office: 'Офіс',
  walk: 'Прогулянка',
  run: 'Біг',
  car: 'Авто',
  baby: 'З дитиною/коляскою',
  bike: 'Велосипед',
};

/** Дружні підписи для вибору «що вдягнути» — «куди збираєшся?» */
const PROFILE_NAMES_OUTFIT = {
  office: 'В офіс',
  walk: 'На прогулянку',
  run: 'Побігати',
  car: 'За кермом',
  baby: 'На прогулянку з дитиною',
  bike: 'На велосипеді',
};

export function profileLabel(key) {
  return PROFILE_NAMES[key] || key;
}

export function profileLabelOutfit(key) {
  return PROFILE_NAMES_OUTFIT[key] || PROFILE_NAMES[key] || key;
}

function formatSunTime(unixUtc, offsetSeconds) {
  if (unixUtc == null || offsetSeconds == null) return '—';
  const d = new Date((unixUtc + offsetSeconds) * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function formatDayLength(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} год ${m} хв`;
}

function moonPhaseToText(phase) {
  if (phase == null) return null;
  if (phase < 0.12) return 'молодик';
  if (phase < 0.37) return 'зростаючий';
  if (phase < 0.5) return 'перша чверть';
  if (phase < 0.62) return 'зростаючий';
  if (phase < 0.88) return 'спадний';
  return 'остання чверть';
}

function uviToLabel(uvi) {
  if (uvi == null) return '—';
  const n = Number(uvi);
  if (n < 3) return 'низький';
  if (n < 6) return 'помірний';
  return 'високий';
}

export function formatWeather(weatherData, cityDisplay, localTime) {
  const c = weatherData.current;
  if (!c) return 'Немає даних про погоду. Будь ласка, вкажіть місто.';

  const offset = weatherData.timezoneOffsetSeconds ?? 0;
  const desc = (c.weather && c.weather.description) ? c.weather.description : 'н/д';
  const pop = weatherData.popMax != null ? Math.round(weatherData.popMax * 100) : 0;
  const uviNum = c.uvi != null ? Number(c.uvi) : null;
  const feels = c.feelsLike != null ? Math.round(c.feelsLike) : null;
  const feelsStr = feels != null ? (feels >= 0 ? '+' : '') + feels + '°' : '—';
  const currentTemp = c.temp != null ? Math.round(c.temp) : null;
  const currentTempStr = currentTemp != null ? (currentTemp >= 0 ? '+' : '') + currentTemp + '°' : '—';

  const cityInLocative = cityDisplay ? cityDisplayToLocative(cityDisplay) : null;
  const cityPart = cityInLocative ? `${cityInLocative} зараз ` : (cityDisplay ? `У ${cityDisplay} зараз ` : 'Зараз ');
  let text = `${cityPart}${desc}, ${currentTempStr}, відчувається як ${feelsStr}.\n`;
  if (pop > 50) text += 'Можливі опади протягом дня. Варто мати парасольку під рукою.\n';
  if (uviNum != null && uviNum >= 3) text += 'Рекомендуємо крем від сонця та головний убір.\n';
  if (pop > 50 || (uviNum != null && uviNum >= 3)) text += '\n';
  text += '\n';

  const temp = c.temp != null ? Math.round(c.temp) : '—';
  const feelsDisplay = c.feelsLike != null ? Math.round(c.feelsLike) : '—';
  const wind = c.windSpeed != null ? Math.round(Number(c.windSpeed) * 10) / 10 : 0;
  const hum = c.humidity != null ? c.humidity : '—';
  const pressureHpa = c.pressure;
  const pressureMm = pressureHpa != null ? Math.round(pressureHpa * 0.750062) : '—';
  const uviLabel = uviToLabel(c.uvi);

  text += `Зараз: ${temp}° (відчувається як ${feelsDisplay}°)\n`;
  text += `Вітер: ${wind} м/с\n`;
  text += `Вологість: ${hum}%\n`;
  text += `Тиск: ${pressureMm} мм\n`;
  if (uviLabel !== '—') text += `UV: ${uviLabel}\n`;
  text += '\n';

  const sunriseStr = formatSunTime(weatherData.sunrise, offset);
  const sunsetStr = formatSunTime(weatherData.sunset, offset);
  const dayLenStr = formatDayLength(weatherData.dayLengthMinutes);
  text += `🌅 Схід сонця: ${sunriseStr}\n`;
  text += `🌇 Захід сонця: ${sunsetStr}\n`;
  text += `Світловий день: ${dayLenStr}\n`;
  text += '\n';

  const moonPhaseLabel = moonPhaseToText(weatherData.moonPhase);
  const moonIllum = weatherData.moonIllumination != null ? `${weatherData.moonIllumination}%` : '—';
  if (moonPhaseLabel || moonIllum !== '—') {
    text += `🌙 Фаза місяця: ${moonPhaseLabel || '—'}\n`;
    text += `Освітленість: ${moonIllum}\n`;
    if (weatherData.daysToFullMoon != null) text += `До повні: приблизно ${weatherData.daysToFullMoon} днів\n`;
  }

  return text.trim();
}

/** Текст для короткого AI-коментаря до картки «зараз». */
export function formatCurrentWeatherDataForAi(weatherData, cityDisplay, localTime, localDate) {
  const c = weatherData?.current;
  if (!c) return '';
  const desc = c.weather && c.weather.description ? c.weather.description : 'н/д';
  const pop = weatherData.popMax != null ? Math.round(weatherData.popMax * 100) : 0;
  const temp = c.temp != null ? Math.round(c.temp) : 'н/д';
  const feels = c.feelsLike != null ? Math.round(c.feelsLike) : 'н/д';
  const wind = c.windSpeed != null ? Math.round(Number(c.windSpeed) * 10) / 10 : 0;
  const hum = c.humidity != null ? c.humidity : 'н/д';
  const uvi = c.uvi != null ? Number(c.uvi) : null;
  const offset = weatherData.timezoneOffsetSeconds ?? 0;
  const sunriseStr = formatSunTime(weatherData.sunrise, offset);
  const sunsetStr = formatSunTime(weatherData.sunset, offset);
  return [
    `Місто: ${cityDisplay || 'н/д'}. Зараз за локальним часом: ${localDate || 'н/д'} ${localTime || ''}.`,
    `Умови: ${desc}. Температура ${temp}°C, відчувається як ${feels}°C.`,
    `Вітер ${wind} м/с, вологість ${hum}%. Ймовірність опадів у найближчі години (за даними прогнозу): до ${pop}%.`,
    uvi != null ? `UV індекс: ${uvi}.` : null,
    `Схід ${sunriseStr}, захід ${sunsetStr}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatAdvice(bullets, explanation, _profileLabel) {
  let text = '';
  if (explanation) text += explanation + '\n\n';
  if (bullets && bullets.length) {
    text += bullets.map(b => `• ${b}`).join('\n');
  }
  return text.trim();
}

export function formatExplain(text) {
  return `🧠 <b>Пояснення</b>\n\n${text}`;
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatProfileMenu(currentProfile) {
  const lines = Object.entries(PROFILE_NAMES).map(([key, label]) => {
    const mark = key === currentProfile ? ' ✓' : '';
    return `${label}${mark}`;
  });
  return '👤 Оберіть профіль:\n\n' + lines.join('\n');
}

export function formatTimeSettings(user) {
  const m = user.autopostMorning ? 'Увімкнено' : 'Вимкнено';
  let t = '⏰ <b>Налаштування нагадування</b>\n\n';
  t += `Одне нагадування на день о 07:30 за місцевим часом: ${m}\n`;
  t += `Час: ${user.morningTime || '07:30'}\n\n`;
  t += 'Можна увімкнути/вимкнути або ввести свій час (наприклад 07:30).';
  return t;
}

const DAY_NAMES_UA = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];

/**
 * День тижня 0–6 (0 = неділя) для календарної дати YYYY-MM-DD.
 * Рядок дати з прогнозу вже «локальний» день міста; зміщення поясу тут не застосовуємо —
 * інакше getUTCDay() після зсуву від UTC-півночі дає чужий день (для UTC+2/3 субота стає п’ятницею).
 */
function dayOfWeekFromDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

/**
 * Один день у блоці «По днях»: заголовок жирним, далі температури, умови й опади окремими рядками.
 */
function formatForecastDayLine(day) {
  const dow = dayOfWeekFromDate(day.date);
  const dayName = DAY_NAMES_UA[dow];
  const [y, month, date] = day.date.split('-').map(Number);
  const monthsUA = ['', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const dateStr = `${date} ${monthsUA[month]}`;
  const title = `${dayName}, ${dateStr}`;

  let tempLine;
  if (day.tempMin != null && day.tempMax != null) {
    const a = `${day.tempMin >= 0 ? '+' : ''}${day.tempMin}°`;
    const b = `${day.tempMax >= 0 ? '+' : ''}${day.tempMax}°`;
    tempLine = `Від ${a} до ${b}`;
  } else if (day.tempMax != null) {
    tempLine = `До ${day.tempMax >= 0 ? '+' : ''}${day.tempMax}°`;
  } else if (day.tempMin != null) {
    tempLine = `Від ${day.tempMin >= 0 ? '+' : ''}${day.tempMin}°`;
  } else {
    tempLine = 'Температура: н/д';
  }

  const rawCond = String(day.condition ?? '').trim();
  const cond = escapeHtml(rawCond || 'н/д');
  const pop = Math.round(Number(day.chanceOfRain) || 0);

  const lines = [`<b>${escapeHtml(title)}</b>`, tempLine, cond];
  if (pop > 0) {
    lines.push(`Опади: до ${pop}%`);
  }
  return lines.join('\n');
}

/** Дружній розгорнутий блок на один день (fallback без AI): від X° вночі до Y° вдень, без крапок. */
function formatForecastWeekendDayBlock(day) {
  const dow = dayOfWeekFromDate(day.date);
  const dayName = DAY_NAMES_UA[dow];
  const [y, month, date] = day.date.split('-').map(Number);
  const monthsUA = ['', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const dateStr = `${date} ${monthsUA[month]}`;
  const tempStr = (day.tempMin != null && day.tempMax != null)
    ? `від ${day.tempMin >= 0 ? '+' : ''}${day.tempMin}° вночі до ${day.tempMax >= 0 ? '+' : ''}${day.tempMax}° вдень`
    : '—';

  let block = `${dayName}, ${dateStr}\n${tempStr}, ${escapeHtml(day.condition || 'н/д')}`;
  const lines = [];
  if (day.tempMorning != null || day.tempNoon != null || day.tempEvening != null) {
    const m = day.tempMorning != null ? (day.tempMorning >= 0 ? '+' : '') + day.tempMorning + '°' : '—';
    const n = day.tempNoon != null ? (day.tempNoon >= 0 ? '+' : '') + day.tempNoon + '°' : '—';
    const e = day.tempEvening != null ? (day.tempEvening >= 0 ? '+' : '') + day.tempEvening + '°' : '—';
    lines.push(`Вранці ${m}, обід ${n}, ввечері ${e}`);
  }
  if (day.chanceOfRain > 0) {
    lines.push(`Ймовірність дощу ${day.chanceOfRain}%`);
  } else {
    lines.push('Опадів не очікується');
  }
  if (day.windMaxMs != null && day.windMaxMs > 0) {
    lines.push(`Вітер до ${day.windMaxMs} м/с`);
  }
  if (lines.length) block += '\n' + lines.join('\n');
  return block;
}

/** Повернути масив днів вихідних (субота, неділя) з forecastData. */
export function getWeekendDays(forecastData) {
  const { days = [] } = forecastData;
  const weekend = [];
  let foundSat = false;
  let foundSun = false;
  for (const d of days) {
    const dow = dayOfWeekFromDate(d.date);
    if (dow === 6 && !foundSat) {
      weekend.push(d);
      foundSat = true;
    } else if (dow === 0 && !foundSun) {
      weekend.push(d);
      foundSun = true;
    }
    if (foundSat && foundSun) break;
  }
  weekend.sort((a, b) => a.date.localeCompare(b.date));
  return weekend;
}

/**
 * Прогноз на вихідні: найближча субота та неділя.
 * forecastData: { days, timezoneOffsetSeconds }
 */
export function formatForecastWeekend(forecastData, cityDisplay) {
  const weekend = getWeekendDays(forecastData);
  if (weekend.length === 0) {
    return 'Найближчих вихідних у прогнозі немає. Спробуйте «Тиждень» або «На 2 тижні».';
  }
  const cityInLocative = cityDisplay ? cityDisplayToLocative(cityDisplay) : null;
  const header = cityInLocative
    ? `📅 Прогноз на вихідні ${cityInLocative}\n\n`
    : (cityDisplay ? `📅 Прогноз на вихідні (${cityDisplay})\n\n` : '📅 Прогноз на вихідні\n\n');
  const body = weekend.map((d) => formatForecastWeekendDayBlock(d)).join('\n\n');
  return header + body;
}

/** Заголовок блоку «Прогноз на вихідні» (для AI або fallback). */
export function getWeekendForecastHeader(cityDisplay) {
  const cityInLocative = cityDisplay ? cityDisplayToLocative(cityDisplay) : null;
  if (cityInLocative) return `📅 Прогноз на вихідні ${cityInLocative}\n\n`;
  if (cityDisplay) return `📅 Прогноз на вихідні (${cityDisplay})\n\n`;
  return '📅 Прогноз на вихідні\n\n';
}

/** Зібрати текст даних вихідних для промпту AI (місто, дні, температури, дощ, вітер). */
export function formatWeekendDataForAi(weekendDays, cityDisplay) {
  const lines = [`Місто: ${cityDisplay || 'н/д'}. Прогноз на найближчі вихідні (субота та неділя).\n`];
  const dayNames = ['Субота', 'Неділя'];
  weekendDays.forEach((d, i) => {
    const name = dayNames[i] || `День ${i + 1}`;
    const [y, month, date] = d.date.split('-').map(Number);
    const monthsUA = ['', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
    lines.push(`${name}, ${date} ${monthsUA[month]}: мін ${d.tempMin != null ? d.tempMin : '?'}°C, макс ${d.tempMax != null ? d.tempMax : '?'}°C, вранці ${d.tempMorning ?? '?'}°, обід ${d.tempNoon ?? '?'}°, ввечері ${d.tempEvening ?? '?'}°. Умови: ${d.condition}. Опади: ${d.chanceOfRain}%. Вітер до ${d.windMaxMs ?? '?'} м/с.`);
  });
  return lines.join('\n');
}

export function daysWordUk(n) {
  const m = n % 100;
  if (m >= 11 && m <= 14) return 'днів';
  switch (n % 10) {
    case 1: return 'день';
    case 2:
    case 3:
    case 4: return 'дні';
    default: return 'днів';
  }
}

/** Якщо після злиття провайдерів днів менше, ніж очікували (7 / 14). */
function partialForecastFooter(shown, asked) {
  if (shown >= asked) return '';
  return `\n\n<i>Є прогноз лише на ${shown} ${daysWordUk(shown)} із ${asked} — безкоштовні API не віддають далі.</i>`;
}

/**
 * Наступні `count` календарних днів від сьогодні (за timezoneOffsetSeconds міста), без «минулих» днів у масиві API.
 */
function rollingForecastDaysFromToday(days, timezoneOffsetSeconds, count) {
  if (!days?.length || count < 1) return [];
  const todayStr = getLocalTimeStrings(timezoneOffsetSeconds || 0).date;
  const sorted = [...days].filter((d) => d && d.date).sort((a, b) => a.date.localeCompare(b.date));
  const idx = sorted.findIndex((d) => d.date >= todayStr);
  const start = idx >= 0 ? idx : 0;
  return sorted.slice(start, start + count);
}

/** Для інших модулів (напр. евристика «коли потепліє»): той самий зріз, що й у прогнозах. */
export function sliceForecastFromToday(forecastData, maxDays) {
  const { days = [], timezoneOffsetSeconds = 0 } = forecastData || {};
  return rollingForecastDaysFromToday(days, timezoneOffsetSeconds, maxDays);
}

/** Заголовок «Наступні N днів» (periodDays — 7 або 14). */
export function getForecastPeriodHeader(cityDisplay, periodDays) {
  const n = periodDays === 7 ? '7 днів' : '14 днів';
  const cityInLocative = cityDisplay ? cityDisplayToLocative(cityDisplay) : null;
  if (cityInLocative) return `📆 Наступні ${n} ${cityInLocative}\n\n`;
  if (cityDisplay) return `📆 Наступні ${n} (${cityDisplay})\n\n`;
  return `📆 Наступні ${n}\n\n`;
}

/**
 * Частини повідомлення для тижня / 14 днів (та для AI).
 * @returns {{ ok: true, header: string, bodyIntroHtml: string, bodyBlock: string, footer: string, dataForAi: string } | { ok: false, fallbackFullMessage: string }}
 */
export function buildForecastPeriodStructured(forecastData, cityDisplay, periodDays) {
  const slice = sliceForecastFromToday(forecastData, periodDays);
  if (!slice.length) {
    return {
      ok: false,
      fallbackFullMessage:
        periodDays === 7 ? 'Немає даних для прогнозу на тиждень.' : 'Немає даних для прогнозу.',
    };
  }
  const header = getForecastPeriodHeader(cityDisplay, periodDays);
  const shown = slice.length;
  const bodyIntroHtml = `<i>По днях — ${shown} ${daysWordUk(shown)} підряд від сьогодні (час у вашому місті):</i>`;
  const bodyBlock = slice.map((d) => formatForecastDayLine(d)).join('\n\n\n');
  const footer = partialForecastFooter(slice.length, periodDays);
  const periodLabel = periodDays === 7 ? 'наступні 7 днів від сьогодні' : 'наступні 14 днів від сьогодні';
  const lines = [
    `Місто: ${cityDisplay || 'н/д'}. Період: ${periodLabel} (локальний час місця з прогнозу).`,
    '',
  ];
  for (const d of slice) {
    const w = d.windMaxMs != null ? `, вітер до ${d.windMaxMs} м/с` : '';
    lines.push(
      `${d.date}: мін ${d.tempMin ?? 'н/д'}°C, макс ${d.tempMax ?? 'н/д'}°C, ${d.condition || 'н/д'}, опади ${Number(d.chanceOfRain) || 0}%${w}`,
    );
  }
  return { ok: true, header, bodyIntroHtml, bodyBlock, footer, dataForAi: lines.join('\n') };
}

/** Прогноз на 7 днів від сьогодні (місцевий час міста). */
export function formatForecastWeek(forecastData, cityDisplay) {
  const s = buildForecastPeriodStructured(forecastData, cityDisplay, 7);
  if (!s.ok) return s.fallbackFullMessage;
  return `${s.header}${s.bodyIntroHtml}\n\n${s.bodyBlock}${s.footer}`;
}

/** Прогноз на 14 днів від сьогодні (місцевий час міста). */
export function formatForecast14Days(forecastData, cityDisplay) {
  const s = buildForecastPeriodStructured(forecastData, cityDisplay, 14);
  if (!s.ok) return s.fallbackFullMessage;
  return `${s.header}${s.bodyIntroHtml}\n\n${s.bodyBlock}${s.footer}`;
}
