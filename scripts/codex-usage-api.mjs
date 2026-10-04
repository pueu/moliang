// This process exports daily aggregate counters only. It never serves session files.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';

const hostname = process.env.USAGE_API_HOST || '127.0.0.1';
const port = Number(process.env.USAGE_API_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('USAGE_API_PORT must be an integer from 1 to 65535.');
const snapshotFile = process.env.CODEX_USAGE_OUTPUT
  ? path.resolve(process.env.CODEX_USAGE_OUTPUT)
  : path.resolve(import.meta.dirname, '../data/codex-usage.json');
const origins = new Set((process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean));
const refreshMs = 5 * 60 * 1000;
let snapshot = null;
let refreshing = false;
let refreshFailed = false;
let activeChild;

function sanitizeSnapshot(value) {
  if (!value || !Array.isArray(value.days) || !Number.isFinite(Date.parse(value.updatedAt))) throw new Error('Invalid usage snapshot.');
  const days = value.days.map(day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error('Invalid usage day.');
    const clean = { date: day.date };
    for (const key of ['tokens', 'inputTokens', 'cachedInputTokens', 'outputTokens']) {
      const count = day[key] ?? 0;
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid usage counter.');
      clean[key] = count;
    }
    return clean;
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { updatedAt: new Date(value.updatedAt).toISOString(), source: 'Codex 会话记录 · 独立使用量服务 · 北京时间', days };
}

async function loadSnapshot() {
  const clean = sanitizeSnapshot(JSON.parse(await fs.readFile(snapshotFile, 'utf8')));
  snapshot = clean;
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    await new Promise((resolve, reject) => {
      activeChild = execFile(process.execPath, [path.join(import.meta.dirname, 'sync-codex-usage.mjs')], {
        env: { ...process.env, CODEX_USAGE_OUTPUT: snapshotFile }, timeout: 120_000, windowsHide: true,
      }, error => {
        activeChild = undefined;
        error ? reject(error) : resolve();
      });
    });
    await loadSnapshot();
    refreshFailed = false;
    console.log(`Usage snapshot refreshed: ${snapshot.days.length} recorded days.`);
  } catch {
    refreshFailed = true;
    if (!snapshot) await loadSnapshot().catch(() => {});
    console.warn(snapshot ? 'Refresh failed; retaining the last good snapshot.' : 'No usage snapshot available yet.');
  } finally {
    refreshing = false;
  }
}

await loadSnapshot().catch(() => {});
await refresh();

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const origin = request.headers.origin;
  response.setHeader('Vary', 'Origin');
  if (origin && !origins.has(origin)) return send(response, 403, { error: 'Origin not allowed.' });
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.writeHead(204);
    return response.end();
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return send(response, 405, { error: 'Method not allowed.' });
  }
  let pathname;
  try {
    pathname = new URL(request.url || '/', 'http://localhost').pathname;
  } catch {
    return send(response, 400, { error: 'Invalid request URL.' });
  }
  if (pathname === '/health') return send(response, 200, { status: snapshot ? 'ok' : 'unavailable', refreshing, stale: refreshFailed, updatedAt: snapshot?.updatedAt ?? null });
  if (pathname === '/api/codex-usage') {
    if (!snapshot) return send(response, 503, { error: 'Usage data is not available yet.' });
    return send(response, 200, { ...snapshot, stale: refreshFailed });
  }
  return send(response, 404, { error: 'Not found.' });
});

server.listen(port, hostname, () => console.log(`Codex usage API: http://${hostname}:${port}/api/codex-usage`));
const timer = setInterval(refresh, refreshMs);
timer.unref();
function stop() {
  clearInterval(timer);
  activeChild?.kill();
  server.close(() => process.exit(0));
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
server.on('error', error => {
  clearInterval(timer);
  console.error(`Usage API could not listen (${error.code || 'unknown error'}).`);
  process.exitCode = 1;
});
