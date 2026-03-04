/**
 * Форматування повідомлень українською.
 */

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
  const tempMin = weatherData.tempMin != null ? Math.round(weatherData.tempMin) : (c.temp != null ? Math.round(c.temp) : null);
  const tempMax = weatherData.tempMax != null ? Math.round(weatherData.tempMax) : (c.temp != null ? Math.round(c.temp) : null);
  let tempRange = '—';
  if (tempMin != null && tempMax != null) {
    if (tempMin === tempMax) {
      tempRange = (tempMin >= 0 ? '+' : '') + tempMin + '°';
    } else {
      tempRange = `${tempMin}°…${tempMax}°`;
    }
  } else if (c.temp != null) {
    tempRange = (Math.round(c.temp) >= 0 ? '+' : '') + Math.round(c.temp) + '°';
  }
  const desc = (c.weather && c.weather.description) ? c.weather.description : 'н/д';
  const pop = weatherData.popMax != null ? Math.round(weatherData.popMax * 100) : 0;
  const uviNum = c.uvi != null ? Number(c.uvi) : null;

  let text = `Сьогодні\n`;
  text += `${tempRange}, ${desc}.\n`;
  if (pop > 50) text += 'Можливі опади протягом дня. Варто мати парасольку під рукою.\n';
  if (uviNum != null && uviNum >= 3) text += 'Рекомендуємо крем від сонця та головний убір.\n';
  if (pop > 50 || (uviNum != null && uviNum >= 3)) text += '\n';
  text += '\n';

  const temp = c.temp != null ? Math.round(c.temp) : '—';
  const feels = c.feelsLike != null ? Math.round(c.feelsLike) : '—';
  const wind = c.windSpeed != null ? c.windSpeed : 0;
  const hum = c.humidity != null ? c.humidity : '—';
  const pressureHpa = c.pressure;
  const pressureMm = pressureHpa != null ? Math.round(pressureHpa * 0.750062) : '—';
  const uviLabel = uviToLabel(c.uvi);

  text += `Зараз: ${temp}° (відчувається як ${feels}°)\n`;
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
