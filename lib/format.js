/**
 * Форматування повідомлень українською.
 */

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

/** Форматувати один день прогнозу: "Понеділок, 10 березня · 5°…12°, дощ · 80% опади" */
function formatForecastDayLine(day) {
  const dow = dayOfWeekFromDate(day.date);
  const dayName = DAY_NAMES_UA[dow];
  const [y, month, date] = day.date.split('-').map(Number);
  const monthsUA = ['', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const dateStr = `${date} ${monthsUA[month]}`;
  const tempStr = (day.tempMin != null && day.tempMax != null)
    ? `${day.tempMin >= 0 ? '+' : ''}${day.tempMin}°…${day.tempMax >= 0 ? '+' : ''}${day.tempMax}°`
    : '—';
  const rain = day.chanceOfRain > 0 ? ` · ${day.chanceOfRain}% опади` : '';
  const cond = escapeHtml(day.condition || 'н/д');
  return `${dayName}, ${dateStr}\n${tempStr}, ${cond}${rain}`;
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

/** Прогноз на тиждень (7 днів). */
export function formatForecastWeek(forecastData, cityDisplay) {
  const { days = [] } = forecastData;
  const week = days.slice(0, 7);
  if (week.length === 0) return 'Немає даних для прогнозу на тиждень.';
  const cityInLocative = cityDisplay ? cityDisplayToLocative(cityDisplay) : null;
  const header = cityInLocative
    ? `📆 Прогноз на тиждень ${cityInLocative}\n\n`
    : (cityDisplay ? `📆 Прогноз на тиждень (${cityDisplay})\n\n` : '📆 Прогноз на тиждень\n\n');
  const body = week.map((d) => formatForecastDayLine(d)).join('\n\n');
  return header + body;
}

/** Прогноз на 14 днів (2 тижні). */
export function formatForecast14Days(forecastData, cityDisplay) {
  const { days = [] } = forecastData;
  if (days.length === 0) return 'Немає даних для прогнозу.';
  const cityInLocative = cityDisplay ? cityDisplayToLocative(cityDisplay) : null;
  const header = cityInLocative
    ? `📆 Прогноз на 2 тижні ${cityInLocative}\n\n`
    : (cityDisplay ? `📆 Прогноз на 2 тижні (${cityDisplay})\n\n` : '📆 Прогноз на 2 тижні\n\n');
  const body = days.map((d) => formatForecastDayLine(d)).join('\n\n');
  return header + body;
}
