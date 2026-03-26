/**
 * Експериментальна евристика «коли нарешті потепліє».
 * Оцінка комфорту по днях з наявних полів прогнозу; без вигаданої точності.
 */

import { sliceForecastFromToday, escapeHtml, daysWordUk } from './format.js';

export const WARM_WINDOW_HEADER = '🌡 <b>Коли нарешті потепліє?</b>\n\n';

const WARM_WINDOW_EMPTY_HINT =
  'Відкрийте «Погода на потім» → «Тиждень» — там усі дні з температурами; з них зручно зорієнтуватись, коли буде м’якше.';

export const WARM_WINDOW_CONFIG = {
  STABLE_WINDOW_MIN: 2,
  STABLE_WINDOW_MAX: 3,
  /** День «достатньо приємний» для вікна */
  DAY_SCORE_STABLE: 48,
  /** Один помітно тепліший день серед холоду */
  DAY_SCORE_SPIKE: 54,
  /** Слабкий позитивний сигнал (для fallback-вікна) */
  DAY_SCORE_WEAK: 36,
  /** Середній бал 2–3 днів, якщо кожен день не дотягнув до STABLE */
  WINDOW_AVG_FALLBACK: 42,
  temp: {
    TMAX_18: 18,
    TMAX_20: 20,
    TMAX_22: 22,
    TMAX_COLD: 14,
    TMIN_OK: 8,
    TMIN_NICE: 11,
    TMIN_COLD: 4,
  },
  rain: {
    POP_SOFT: 35,
    POP_MOD: 55,
    POP_HARD: 75,
  },
  wind: {
    MS_WARN: 9,
    MS_BAD: 13,
  },
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function normCond(s) {
  return String(s || '').toLowerCase();
}

/** Бонуси/штрафи з тексту умов (укр. + частково англ.). */
function condSignals(cond) {
  const c = normCond(cond);
  let delta = 0;
  if (/гроз|гром|буря|шторм|грозов|thunder|storm/i.test(c)) delta -= 42;
  if (/злив|сильн\w* дощ|проливн|heavy rain|downpour/i.test(c)) delta -= 22;
  if (/туман|fog/i.test(c)) delta -= 12;
  if (/ясн(о)?\b|без хмар|сонячн|мало хмар|clear|sunny/i.test(c)) delta += 8;
  if (/повн\w* хмар|суцільн\w* хмар|сильн\w* хмар/i.test(c)) delta -= 6;
  return delta;
}

export function scoreForecastDayComfort(day) {
  const C = WARM_WINDOW_CONFIG;
  const tmax = day.tempMax;
  const tmin = day.tempMin;
  const pop = Number(day.chanceOfRain) || 0;
  const wind = day.windMaxMs != null ? Number(day.windMaxMs) : null;

  let s = 48;

  if (tmax != null) {
    if (tmax >= C.temp.TMAX_22) s += 22;
    else if (tmax >= C.temp.TMAX_20) s += 18;
    else if (tmax >= C.temp.TMAX_18) s += 12;
    else if (tmax < C.temp.TMAX_COLD) s -= 28;
    else s -= 8;
  } else {
    s -= 15;
  }

  if (tmin != null) {
    if (tmin >= C.temp.TMIN_NICE) s += 14;
    else if (tmin >= C.temp.TMIN_OK) s += 6;
    else if (tmin < C.temp.TMIN_COLD) s -= 22;
    else s -= 8;
  }

  if (pop >= C.rain.POP_HARD) s -= 32;
  else if (pop >= C.rain.POP_MOD) s -= 18;
  else if (pop >= C.rain.POP_SOFT) s -= 8;

  if (wind != null && Number.isFinite(wind)) {
    if (wind >= C.wind.MS_BAD) s -= 16;
    else if (wind >= C.wind.MS_WARN) s -= 8;
  }

  s += condSignals(day.condition);
  return clamp(s, 0, 100);
}

const DAY_NAMES_UA = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
const MONTHS_UA = ['', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

function captionForDate(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!y || !mo || !d) return escapeHtml(String(dateStr));
  const dow = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
  return `${DAY_NAMES_UA[dow]}, ${d} ${MONTHS_UA[mo]}`;
}

function tempSpan(day) {
  const a = day.tempMin;
  const b = day.tempMax;
  if (a == null && b == null) return null;
  if (a != null && b != null) return `${a >= 0 ? '+' : ''}${a}°…${b >= 0 ? '+' : ''}${b}°`;
  if (b != null) return `до ${b >= 0 ? '+' : ''}${b}°`;
  return `від ${a >= 0 ? '+' : ''}${a}°`;
}

function rainLineForDays(days) {
  const mx = Math.max(0, ...days.map((d) => Number(d.chanceOfRain) || 0));
  if (mx >= 55) return `Опади: до ${Math.round(mx)}% за день.`;
  if (mx >= 25) return `Опади: помірна ймовірність (до ${Math.round(mx)}%).`;
  return 'Опади: на ці дні помітних не очікується.';
}

function avg(scoredSlice) {
  return scoredSlice.reduce((a, x) => a + x.score, 0) / scoredSlice.length;
}

/**
 * Перше хронологічне вікно: спочатку шукаємо довше (3 дні), потім 2.
 * @param {Array<{ score: number, day: object }>} scored
 */
function findFirstStableWindow(scored, minLen, maxLen, predicate) {
  for (let len = maxLen; len >= minLen; len--) {
    for (let i = 0; i + len <= scored.length; i++) {
      const slice = scored.slice(i, i + len);
      if (predicate(slice)) return slice.map((x) => x.day);
    }
  }
  return null;
}

/** Зріз від «сьогодні»; якщо порожньо — перші відсортовані дні (рідко, коли зсув дати). */
function horizonDaysOrFallback(forecastData, maxDays) {
  const slice = sliceForecastFromToday(forecastData, maxDays);
  if (slice.length > 0) return slice;
  const raw = (forecastData?.days || []).filter((d) => d && d.date);
  if (!raw.length) return [];
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(0, maxDays);
}

/** Максимальний бал; при рівності — вищий tmax, потім раніша дата. */
function pickBestWarmSignalDay(scored) {
  if (!scored.length) return null;
  let best = scored[0];
  for (let i = 1; i < scored.length; i++) {
    const x = scored[i];
    if (x.score > best.score) best = x;
    else if (x.score === best.score) {
      const xt = x.day.tempMax ?? -999;
      const bt = best.day.tempMax ?? -999;
      if (xt > bt) best = x;
      else if (xt === bt && x.day.date < best.day.date) best = x;
    }
  }
  return best;
}

/**
 * Лише фактичний блок (HTML), без заголовка. `null`, якщо немає жодного дня.
 */
export function formatWarmWindowBodyHtml(forecastData) {
  const C = WARM_WINDOW_CONFIG;
  const horizon = horizonDaysOrFallback(forecastData, 16);

  if (horizon.length === 0) {
    return null;
  }

  const scored = horizon.map((day) => ({ score: scoreForecastDayComfort(day), day }));

  const thr = C.DAY_SCORE_STABLE;
  let stableDays = findFirstStableWindow(
    scored,
    C.STABLE_WINDOW_MIN,
    C.STABLE_WINDOW_MAX,
    (sl) => sl.every((x) => x.score >= thr),
  );

  if (!stableDays) {
    stableDays = findFirstStableWindow(
      scored,
      C.STABLE_WINDOW_MIN,
      C.STABLE_WINDOW_MAX,
      (sl) =>
        avg(sl) >= C.WINDOW_AVG_FALLBACK && sl.every((x) => x.score >= C.DAY_SCORE_WEAK),
    );
  }

  const nDays = horizon.length;
  const scopeLine = `<i>Оцінка за наступні ${nDays} ${daysWordUk(nDays)} від сьогодні (час — як у вашому місті).</i>\n\n`;

  let body;
  if (stableDays && stableDays.length >= C.STABLE_WINDOW_MIN) {
    const a = captionForDate(stableDays[0].date);
    const b = captionForDate(stableDays[stableDays.length - 1].date);
    const temps = stableDays.map(tempSpan).filter(Boolean).join('; ');
    const rain = rainLineForDays(stableDays);

    if (stableDays.length >= C.STABLE_WINDOW_MAX) {
      body = `Схоже, перший відносно стабільний приємніший період — приблизно з <b>${a}</b> по <b>${b}</b> (${temps || '—'}). ${rain}`;
    } else {
      body = `Найближче «вікно» потепління — <b>${a}</b> і <b>${b}</b> (${temps || '—'}). Це лише кілька днів; довкола може бути прохолодніше. ${rain}`;
    }
  } else {
    const spikeIdx = scored.findIndex((x) => x.score >= C.DAY_SCORE_SPIKE);
    if (spikeIdx >= 0) {
      const d = scored[spikeIdx].day;
      const laterStable = findFirstStableWindow(
        scored.slice(spikeIdx + 1),
        C.STABLE_WINDOW_MIN,
        C.STABLE_WINDOW_MAX,
        (sl) => sl.every((x) => x.score >= thr),
      );
      const cap = captionForDate(d.date);
      const tail = laterStable
        ? ` Далі стабільніше тепло ближче до <b>${captionForDate(laterStable[0].date)}</b> — <b>${captionForDate(laterStable[laterStable.length - 1].date)}</b>.`
        : ' Наступні дні за прогнозом прохолодніші.';
      body = `Є один відносно тепліший день — <b>${cap}</b> (${tempSpan(d) || '—'}).${tail} ${rainLineForDays([d])}`;
    } else {
      const pick = pickBestWarmSignalDay(scored);
      const b = pick.day;
      const rel =
        pick.score >= C.DAY_SCORE_WEAK
          ? 'Найближче до приємнішої погоди — '
          : 'Найтепліший день у цьому прогнозі — ';
      body = `${rel}<b>${captionForDate(b.date)}</b> (${tempSpan(b) || '—'}). ${rainLineForDays([b])}`;
    }
  }

  return scopeLine + body;
}

/** Текст для промпту AI: місто + дні з прогнозу. */
export function formatWarmWindowDataForAi(forecastData, cityDisplay) {
  const horizon = horizonDaysOrFallback(forecastData, 16);
  if (!horizon.length) return '';
  const lines = [
    `Місто: ${cityDisplay || 'н/д'}. Питання користувача: коли буде відчутно тепліше / м’якше на вулиці.`,
    'Нижче — денні значення в локальному часі місця з прогнозу (орієнтовно).',
    '',
  ];
  for (const d of horizon) {
    const w = d.windMaxMs != null ? `, вітер до ${d.windMaxMs} м/с` : '';
    lines.push(
      `${d.date}: мін ${d.tempMin ?? 'н/д'}°C, макс ${d.tempMax ?? 'н/д'}°C, ${d.condition || 'н/д'}, опади ${Number(d.chanceOfRain) || 0}%${w}`,
    );
  }
  return lines.join('\n');
}

/**
 * Повна відповідь без AI (HTML).
 */
export function formatWarmWindowMessage(forecastData) {
  const body = formatWarmWindowBodyHtml(forecastData);
  if (body == null) {
    return WARM_WINDOW_HEADER + WARM_WINDOW_EMPTY_HINT;
  }
  return WARM_WINDOW_HEADER + body;
}
