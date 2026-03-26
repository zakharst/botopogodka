/**
 * Захищений дашборд: статистика користувачів і подій.
 * Пароль: змінна середовища DASHBOARD_PASSWORD, передається заголовком X-Dashboard-Key.
 */

import { dashboardAuthOk, getDashboardSnapshot } from '../lib/analytics.js';
import { profileLabel } from '../lib/format.js';

const EVENT_LABELS = {
  start: '/start',
  help: '/help',
  weather_now: 'Погода зараз',
  forecast_menu: 'Обрати період прогнозу',
  forecast_weekend: 'Прогноз на вихідні',
  forecast_week: 'Прогноз на тиждень',
  forecast_14d: 'Прогноз на 2 тижні',
  outfit_menu: 'Що вдягнути — вибір профілю',
  outfit_advice: 'Що вдягнути — відповідь',
  outfit_trigger_text: 'Текст «що вдягнути»',
  profile_menu: 'Профіль (меню)',
  profile_set: 'Зміна профілю',
  city_flow_start: 'Зміна міста',
  city_set: 'Місто збережено',
  city_text_weather: 'Місто текстом → погода',
  morning_time_set: 'Час нагадування збережено',
  time_settings: 'Налаштування часу',
  autopost_on: 'Ранковий нагадування УВІМК',
  autopost_off: 'Ранковий нагадування ВИМК',
  time_prompt: 'Запит часу нагадування',
  settings_open: 'Налаштування (екран)',
  back_menu: 'Назад у меню',
  help_callback: 'Допомога (кнопка)',
  restart: 'Рестарт (/start з нуля)',
  autopost_sent: 'Ранковий автопост (cron)',
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDashboard(snapshot) {
  const eventsSorted = Object.entries(snapshot.events || {})
    .map(([key, val]) => ({
      key,
      count: Number(val) || 0,
      label: EVENT_LABELS[key] || key,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const eventsRows = eventsSorted
    .map(
      (r) =>
        `<tr><td>${esc(r.label)}</td><td class="num"><code>${esc(r.key)}</code></td><td class="num">${r.count}</td></tr>`,
    )
    .join('');

  const dauRows = (snapshot.dauLast30Days || [])
    .map(([day, n]) => `<tr><td>${esc(day)}</td><td class="num">${n}</td></tr>`)
    .join('');

  const profiles = Object.entries(snapshot.profileCounts || {})
    .map(([k, n]) => ({ k, n, label: profileLabel(k) }))
    .sort((a, b) => b.n - a.n);
  const profileRows = profiles
    .map((p) => `<tr><td>${esc(p.label)}</td><td class="num"><code>${esc(p.k)}</code></td><td class="num">${p.n}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Ботопогодка — статистика</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf1; --muted:#8b9cb3; --accent:#5b9fd4; --border:#2a3a4d; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 1.25rem; line-height: 1.5; }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.25rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
    .card .val { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
    .card .lbl { font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; }
    section { margin-bottom: 1.75rem; }
    h2 { font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--card); border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
    th, td { text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); }
    th { background: #141c28; color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    tr:last-child td { border-bottom: none; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    code { font-size: 0.8em; background: #141c28; padding: 0.12rem 0.35rem; border-radius: 4px; }
    .note { color: var(--muted); font-size: 0.8rem; margin-top: 1rem; max-width: 42rem; }
  </style>
</head>
<body>
  <h1>Ботопогодка</h1>
  <p class="sub">Оновлено: ${esc(snapshot.generatedAt)} · Унікальні активні (UAU за день) — за UTC-датою</p>
  <div class="grid">
    <div class="card"><div class="val">${snapshot.totalUsers}</div><div class="lbl">Записів користувачів (user:*)</div></div>
    <div class="card"><div class="val">${snapshot.usersWithLocation}</div><div class="lbl">З містом / координатами</div></div>
    <div class="card"><div class="val">${snapshot.autopostMorningUsers}</div><div class="lbl">Ранкове нагадування увімкнено</div></div>
    <div class="card"><div class="val">${snapshot.totalEvents}</div><div class="lbl">Усього зафіксованих подій</div></div>
  </div>
  <section>
    <h2>Найчастіші дії</h2>
    <table>
      <thead><tr><th>Дія</th><th>Ключ</th><th>Разів</th></tr></thead>
      <tbody>${eventsRows || '<tr><td colspan="3" style="color:var(--muted)">Ще немає даних після деплою з аналітикою</td></tr>'}</tbody>
    </table>
    <p class="note">Лічильники подій накопичуються з моменту останнього деплою з цією версією. Раніше взаємодії не підраховані.</p>
  </section>
  <section>
    <h2>Активні користувачі по днях (UAU)</h2>
    <table>
      <thead><tr><th>День (UTC)</th><th>Унікальних user id</th></tr></thead>
      <tbody>${dauRows || '<tr><td colspan="2" style="color:var(--muted)">Немає даних</td></tr>'}</tbody>
    </table>
  </section>
  <section>
    <h2>Розподіл профілів (зараз у базі)</h2>
    <table>
      <thead><tr><th>Профіль</th><th>Ключ</th><th>Користувачів</th></tr></thead>
      <tbody>${profileRows || '<tr><td colspan="3" style="color:var(--muted)">—</td></tr>'}</tbody>
    </table>
  </section>
</body>
</html>`;
}

function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Вхід — Ботопогодка</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0f1419; color:#e7ecf1; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:1rem; }
    .box { background:#1a2332; border:1px solid #2a3a4d; border-radius:12px; padding:1.5rem; width:100%; max-width:360px; }
    h1 { font-size:1.1rem; margin:0 0 1rem; }
    input { width:100%; padding:0.65rem; border-radius:8px; border:1px solid #2a3a4d; background:#141c28; color:inherit; margin-bottom:0.75rem; }
    button { width:100%; padding:0.7rem; border:none; border-radius:8px; background:#5b9fd4; color:#0f1419; font-weight:600; cursor:pointer; }
    button:hover { filter:brightness(1.08); }
    .hint { font-size:0.8rem; color:#8b9cb3; margin-top:0.75rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Статистика бота</h1>
    <input type="password" id="p" placeholder="Пароль" autocomplete="current-password"/>
    <button type="button" id="b">Увійти</button>
    <p class="hint">Пароль задається в Vercel як DASHBOARD_PASSWORD.</p>
  </div>
  <script>
    async function go() {
      var pw = document.getElementById('p').value;
      var r = await fetch(location.pathname, { headers: { 'X-Dashboard-Key': pw } });
      if (!r.ok) { alert('Невірний пароль або сервер недоступний'); return; }
      document.open();
      document.write(await r.text());
      document.close();
    }
    document.getElementById('b').onclick = go;
    document.getElementById('p').onkeydown = function(e) { if (e.key === 'Enter') go(); };
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (!process.env.DASHBOARD_PASSWORD) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Налаштування</title></head><body style="font-family:sans-serif;padding:2rem">Задайте змінну <code>DASHBOARD_PASSWORD</code> у Vercel (Environment Variables) і задеплойте знову.</body></html>',
    );
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }

  if (req.method === 'HEAD') {
    res.statusCode = dashboardAuthOk(req) ? 200 : 401;
    res.end();
    return;
  }

  const rawKey = req.headers['x-dashboard-key'];
  if (!dashboardAuthOk(req)) {
    if (rawKey != null && String(rawKey).length > 0) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderLoginPage());
    return;
  }

  try {
    const snapshot = await getDashboardSnapshot();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderDashboard(snapshot));
  } catch (e) {
    console.error('dashboard', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<pre>${esc(String(e.message || e))}</pre>`);
  }
}
