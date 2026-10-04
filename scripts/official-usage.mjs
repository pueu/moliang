import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export class UsageError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const safeInteger = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// Explicit whitelist: never return account identifiers, auth tokens, or threads.
export function normalizeOfficialUsage(result, fetchedAt = new Date().toISOString()) {
  if (!result || !Array.isArray(result.dailyUsageBuckets)) throw new UsageError('daily_usage_unavailable');
  const counts = new Map();
  for (const bucket of result.dailyUsageBuckets) {
    const date = bucket?.startDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !safeInteger(bucket.tokens)) throw new UsageError('invalid_daily_usage');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new UsageError('invalid_daily_usage');
    const total = (counts.get(date) || 0) + bucket.tokens;
    if (!safeInteger(total)) throw new UsageError('invalid_daily_usage');
    counts.set(date, total);
  }
  return {
    updatedAt: fetchedAt,
    source: 'OpenAI Codex · 官方账号用量',
    days: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([date, tokens]) => ({ date, tokens })),
  };
}

// Documented JSONL app-server protocol; only initialize and account/usage/read.
export async function readOfficialUsage({ binary = process.env.CODEX_BINARY || 'codex', timeoutMs = 25000 } = {}) {
  const proc = spawn(binary, ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const lines = createInterface({ input: proc.stdout });
  const pending = new Map();
  let id = 0;
  const rejectAll = code => { for (const request of pending.values()) request.reject(new UsageError(code)); pending.clear(); };
  proc.on('error', () => rejectAll('codex_start_failed'));
  proc.on('exit', () => rejectAll('codex_exited'));
  proc.stdin.on('error', () => rejectAll('codex_pipe_closed'));
  // Drain stderr without logging potentially private account/config diagnostics.
  proc.stderr.resume();
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new UsageError(request.method === 'initialize' ? 'codex_initialize_failed' : 'official_usage_failed'));
    else request.resolve(message.result);
  });
  const send = message => proc.stdin.write(`${JSON.stringify(message)}\n`);
  const call = method => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject, method });
    send({ id: requestId, method, params: method === 'initialize' ? { clientInfo: { name: 'moliang_usage_gateway', title: 'Moliang Usage Gateway', version: '1.0.0' } } : {} });
  });
  const timeout = setTimeout(() => rejectAll('official_usage_timeout'), timeoutMs);
  try {
    await call('initialize');
    send({ method: 'initialized', params: {} });
    return normalizeOfficialUsage(await call('account/usage/read'));
  } finally {
    clearTimeout(timeout);
    lines.close();
    proc.stdin.end();
    proc.kill();
  }
}
