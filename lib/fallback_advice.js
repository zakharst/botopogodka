/**
 * Детерміновані поради українською, коли AI вимкнений або недоступний.
 * Тон 3.0: дружній, спокійний, трохи розмовний; без драми та зайвих емоцій.
 */

import { profileLabel } from './format.js';

export function getFallbackOutfit(weatherData, profileKey) {
  const c = weatherData.current || {};
  const temp = c.feelsLike != null ? c.feelsLike : c.temp;
  const wind = c.windSpeed != null ? c.windSpeed : 0;
  const pop = weatherData.popMax != null ? weatherData.popMax : 0;
  const profile = profileLabel(profileKey);

  // 1–2 речення інтерпретації погоди (дружньо, без драми)
  let explanation = '';
  if (temp != null) {
    const t = Math.round(temp);
    if (temp < -5) explanation = `Сьогодні холодно, відчувається близько ${t}°. Раджу тепло вбратися.`;
    else if (temp < 5) explanation = `Сьогодні трохи прохолодно, особливо з вітром (відчувається близько ${t}°).`;
    else if (temp < 15) explanation = `Сьогодні помірно, близько ${t}°. Мати шар під рукою не завадить.`;
    else if (temp < 25) explanation = `Сьогодні тепло, близько ${t}°. Легкий одяг підійде; вранці та ввечері може бути свіжіше.`;
    else explanation = `Сьогодні спекотно, близько ${t}°. Легкий одяг та захист від сонця — саме те.`;
  } else {
    explanation = 'Орієнтуйся на опис погоди нижче — під нього можна підлаштувати одяг.';
  }
  if (profile && profile !== 'звичайний') explanation += ` Враховую профіль: ${profile}.`;

  const bullets = [];
  if (temp != null) {
    if (temp < -5) {
      bullets.push('🧥 Тепла зимова куртка');
      bullets.push('👕 Теплий шар, шапка, рукавички');
      bullets.push('👟 Тепле взуття');
      if (wind > 5) bullets.push('Якщо чутливі до холоду — додатковий шарф.');
    } else if (temp < 5) {
      bullets.push('🧥 Легка куртка або пальто');
      bullets.push('👕 Теплий шар під низ, шапка, шарф');
      bullets.push('👟 Тепліше взуття');
      if (wind > 8) bullets.push('Якщо вітер сильний — краще вітрозахисна куртка або капюшон.');
    } else if (temp < 15) {
      bullets.push('🧥 Легка куртка або светр');
      bullets.push('👕 Можна без шапки; мати щось тепліше під рукою');
      bullets.push('👟 Звичайне взуття');
      if (profileKey === 'run') bullets.push('Якщо активно рухатиметеся — достатньо легкої куртки.');
    } else if (temp < 25) {
      bullets.push('👕 Легкий одяг, довгий рукав вранці/ввечері');
      bullets.push('👟 Зручне взуття');
      bullets.push('Сонцезахист у сонячний день.');
    } else {
      bullets.push('👕 Легкий, провітрюваний одяг');
      bullets.push('👟 Відкрите взуття за бажанням');
      bullets.push('Варто вода та головний убір від сонця.');
    }
  }

  const descLower = (c.weather && c.weather.description) ? String(c.weather.description).toLowerCase() : '';
  const suggestsPrecip = /дощ|drizzle|rain|snow|сніг|опади|shower|thunder/i.test(descLower);
  const showUmbrella = pop > 0.5 || (pop > 0.35 && suggestsPrecip);
  if (showUmbrella) bullets.push('☔ Варто мати парасольку під рукою.');
  const uvi = c.uvi != null ? Number(c.uvi) : null;
  if (uvi != null && uvi >= 3 && !bullets.some(b => b.includes('сонц') || b.includes('убір') || b.includes('UV'))) {
    bullets.push(uvi >= 6 ? 'При високому UV — крем від сонця та головний убір.' : 'При помірному UV — крем від сонця та головний убір не завадять.');
  }
  if (wind > 8 && !bullets.some(b => b.includes('вітр') || b.includes('капюшон'))) bullets.push('При сильному вітрі — куртка з капюшоном або вітрозахисна.');
  if (profileKey === 'baby') bullets.push('Для дитини: додаткова куртка або плед, захист від дощу.');
  if (profileKey === 'moto') bullets.push('На мото: відповідний захист та видимість.');

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
  if (temp != null) text += `Відчувається близько ${Math.round(temp)}°. `;
  if (wind > 6) text += `Вітер помірний або сильний — варто врахувати. `;
  if (pop > 0.2) text += `Ймовірні опади в найближчі години. `;
  text += 'Рекомендую орієнтуватися на погоду та зручний одяг під ваш профіль.';
  return { bullets: [], explanation: text };
}
