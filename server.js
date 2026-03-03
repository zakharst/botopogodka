/**
 * Локальний сервер для тестування webhook без Vercel CLI.
 * Запуск: node server.js
 * .env має бути в корені проєкту.
 */

import { readFileSync } from 'fs';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Завантажити .env
try {
  const envPath = join(__dirname, '.env');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn('Не вдалося прочитати .env:', e.message);
}

const PORT = Number(process.env.PORT) || 3000;

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (url.pathname !== '/api/webhook' || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    body = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  const mockReq = { method: 'POST', body };
  const mockRes = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    },
  };

  const { default: handler } = await import('./api/webhook.js');
  await handler(mockReq, mockRes);
}).listen(PORT, () => {
  console.log(`Локальний сервер: http://localhost:${PORT}`);
  console.log(`Webhook URL для Telegram: http://localhost:${PORT}/api/webhook`);
  console.log('Щоб Telegram міг слати оновлення, потрібен ngrok (див. нижче).');
});
