/**
 * Форматування повідомлень українською.
 */

const PROFILE_NAMES = {
  office: 'Офіс',
  walk: 'Прогулянка',
  run: 'Біг',
  car: 'Авто',
  baby: 'З дитиною/коляскою',
  moto: 'Мото/скутер',
};

export function profileLabel(key) {
  return PROFILE_NAMES[key] || key;
}

export function formatWeather(weatherData, cityDisplay, localTime) {
  const c = weatherData.current;
  if (!c) return 'Немає даних про погоду.\nВкажіть місто в меню «📍 Місто».';

  const temp = c.temp != null ? Math.round(c.temp) : '—';
  const feels = c.feelsLike != null ? Math.round(c.feelsLike) : '—';
  const wind = c.windSpeed != null ? c.windSpeed : 0;
  const hum = c.humidity != null ? c.humidity : '—';
  const desc = (c.weather && c.weather.description) ? c.weather.description : 'н/д';
  const pop = weatherData.popMax != null ? Math.round(weatherData.popMax * 100) : 0;

  let text = `🌤 <b>${escapeHtml(cityDisplay || 'Місто')}</b> ${localTime ? `(${localTime})` : ''}\n\n`;
  text += `Температура: <b>${temp}°C</b> (відчувається ${feels}°C)\n`;
  text += `Опис: ${desc}\n`;
  text += `Вітер: ${wind} м/с\n`;
  text += `Вологість: ${hum}%\n`;
  if (pop > 0) text += `Ймовірність опадів (найбл. 12 год): до ${pop}%\n`;
  return text;
}

export function formatAdvice(bullets, explanation, profileLabel) {
  let text = `🧥 <b>Що вдягнути</b> (профіль: ${escapeHtml(profileLabel)})\n\n`;
  if (bullets && bullets.length) {
    text += bullets.map(b => `• ${b}`).join('\n') + '\n\n';
  }
  if (explanation) text += explanation;
  return text;
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
