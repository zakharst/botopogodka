/**
 * Детерміновані поради українською, коли AI вимкнений або недоступний.
 */

import { profileLabel } from './format.js';

export function getFallbackOutfit(weatherData, profileKey) {
  const c = weatherData.current || {};
  const temp = c.feelsLike != null ? c.feelsLike : c.temp;
  const wind = c.windSpeed != null ? c.windSpeed : 0;
  const pop = weatherData.popMax != null ? weatherData.popMax : 0;
  const profile = profileLabel(profileKey);

  const bullets = [];
  if (temp != null) {
    if (temp < -5) {
      bullets.push('Тепла зимова куртка, шапка, рукавички, теплий взуття.');
      bullets.push('Уникай довгого перебування на морозі.');
    } else if (temp < 5) {
      bullets.push('Куртка або пальто, шапка, шарф.');
      bullets.push('Тепліший взуття.');
    } else if (temp < 15) {
      bullets.push('Легка куртка або светр.');
      bullets.push('Можна без шапки, але май щось тепліше під рукою.');
    } else if (temp < 25) {
      bullets.push('Легкий одяг, можна довгий рукав вранці/ввечері.');
      bullets.push('Сонцезахист у сонячний день.');
    } else {
      bullets.push('Легкий, провітрюваний одяг.');
      bullets.push('Обов\'язково вода та головний убір від сонця.');
    }
  }

  if (wind > 8) bullets.push('Сильний вітер — краще куртка з капюшоном або вітрозахисна.');
  if (wind > 12 && (profileKey === 'moto' || profileKey === 'run')) {
    bullets.push('При бігу/мото обережно з вітром.');
  }
  if (pop > 0.3) bullets.push('Ймовірні опади — візьми парасольку або непромокальну куртку.');
  if (profileKey === 'baby') bullets.push('Для дитини візьми додаткову куртку/плед та захист від дощу.');
  if (profileKey === 'moto') bullets.push('На мото/скутері — відповідний захист та видимість.');

  const explanation = `За погодою (відчувається ${temp != null ? Math.round(temp) + '°C' : 'н/д'}) та профілем «${profile}» — перелічені рекомендації допоможуть підібрати одяг.`;
  return { bullets, explanation };
}

export function getFallbackExplain(weatherData, profileKey) {
  const c = weatherData.current || {};
  const temp = c.feelsLike != null ? c.feelsLike : c.temp;
  const wind = c.windSpeed != null ? c.windSpeed : 0;
  const pop = weatherData.popMax != null ? weatherData.popMax : 0;
  const desc = (c.weather && c.weather.description) ? c.weather.description : '';

  let text = '';
  if (desc) text += `Зараз: ${desc}. `;
  if (temp != null) text += `Температура відчувається близько ${Math.round(temp)}°C. `;
  if (wind > 6) text += `Вітер помірний або сильний — варто врахувати при виборі одягу. `;
  if (pop > 0.2) text += `Є ймовірність опадів у найближчі години. `;
  text += 'Одягайся за погодою та обирай зручний одяг під свій профіль.';
  return { bullets: [], explanation: text };
}
