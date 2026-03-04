#!/usr/bin/env node
/**
 * Показати, як виглядатиме погода з поточним провайдером (WeatherAPI або OpenWeather).
 * Запуск: node --env-file=.env scripts/test-weather-preview.js
 *        або: WEATHERAPI_API_KEY=xxx node scripts/test-weather-preview.js
 */

import * as weather from '../lib/weather.js';
import * as format from '../lib/format.js';

const cityQuery = process.argv[2] || 'Warsaw, Poland';

async function main() {
  console.log('Місто:', cityQuery);
  console.log('Провайдер:', process.env.WEATHERAPI_API_KEY ? 'WeatherAPI' : 'OpenWeather');
  console.log('---');

  const geo = await weather.geocode(cityQuery);
  if (!geo) {
    console.log('Місто не знайдено.');
    return;
  }
  console.log('Знайдено:', geo.displayName, `(${geo.lat}, ${geo.lon})\n`);

  const w = await weather.getOneCall(geo.lat, geo.lon);
  const offset = w.timezoneOffsetSeconds ?? 0;
  const local = weather.getLocalTimeStrings(offset);
  const text = format.formatWeather(w, geo.displayName, local.time);

  console.log('=== Як у боті ===\n');
  console.log(text);
  console.log('\n=== Кінець ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
