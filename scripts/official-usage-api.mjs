import http from 'node:http';
import { readOfficialUsage, UsageError } from './official-usage.mjs';

if (process.argv.includes('--check')) {
  try {
    const usage = await readOfficialUsage();
    console.log(JSON.stringify({ ok: true, source: usage.source, dayCount: usage.days.length, tokens: usage.days.reduce((sum, day) => sum + day.tokens, 0) }));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, code: error instanceof UsageError ? error.code : 'internal_error' }));
    process.exitCode = 1;
  }
} else {
  const host = process.env.USAGE_API_HOST || '127.0.0.1';
  const port = Number(process.env.USAGE_API_PORT || 8787);
  const origin = process.env.CORS_ORIGIN || 'https://pueu.github.io';
  let cached = null;
  let fetching = null;
  async function usage() {
    if (cached && Date.now() - cached.time < 300000) return cached.data;
    if (!fetching) fetching = readOfficialUsage().then(data => { cached = { time: Date.now(), data }; return data; }).finally(() => { fetching = null; });
    return fetching;
  }
  const server = http.createServer(async (req, res) => {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', Vary: 'Origin' };
    const reply = (status, body) => { res.writeHead(status, headers); res.end(body == null ? '' : JSON.stringify(body)); };
    if (req.headers.origin && req.headers.origin !== origin) return reply(403, { error: 'origin_not_allowed' });
    if (req.headers.origin === origin) headers['Access-Control-Allow-Origin'] = origin;
    if (!['GET', 'OPTIONS'].includes(req.method)) return reply(405, { error: 'method_not_allowed' });
    if (req.url !== '/health' && req.url !== '/api/codex-usage') return reply(404, { error: 'not_found' });
    if (req.method === 'OPTIONS') { headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'; return reply(204, null); }
    if (req.url === '/health') return reply(200, { ok: true });
    try { return reply(200, await usage()); }
    catch (error) { return reply(503, { error: error instanceof UsageError ? error.code : 'internal_error' }); }
  });
  server.requestTimeout = 30000;
  server.listen(port, host, () => console.log(`Official usage gateway: http://${host}:${port}/api/codex-usage`));
}
