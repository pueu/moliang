/** Shapes accepted from public third-party endpoints; no local records are read. */
export interface NormalizedUsageSnapshot {
  updatedAt: string;
  source: string;
  days: { date: string; tokens: number; inputTokens: number; cachedInputTokens: number; outputTokens: number }[];
}
type RecordValue = Record<string, unknown>;
type Day = NormalizedUsageSnapshot['days'][number];

function record(value: unknown, message: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as RecordValue;
}
function counter(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('用量接口包含无效的 Token 数量');
  return value;
}
function dateKey(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('用量接口包含无效日期');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('用量接口包含无效日期');
  return value;
}
function updatedAt(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('账号尚未提交有效的用量记录');
  return new Date(value).toISOString();
}
function mergeDay(map: Map<string, Day>, day: Day) {
  const existing = map.get(day.date);
  if (!existing) { map.set(day.date, day); return; }
  for (const field of ['tokens', 'inputTokens', 'cachedInputTokens', 'outputTokens'] as const) existing[field] = counter(existing[field] + day[field]);
}

/** Official profile totals include every client; use only explicit Codex rows.
 * https://github.com/junhoyeo/tokscale/blob/main/packages/frontend/src/lib/publicProfileData.ts
 * Tokscale reports cache and reasoning categories separately; count each once.
 */
export function normalizeTokscaleUsage(value: unknown): NormalizedUsageSnapshot {
  const root = record(value, '用量接口返回格式不正确');
  if (typeof root.error === 'string') throw new Error(root.error === 'User not found' ? '账号尚未建立公开用量档案' : '用量服务返回错误');
  const user = record(root.user, '用量接口缺少公开账号信息');
  if (typeof user.username !== 'string' || !user.username.trim() || user.username.length > 80) throw new Error('用量接口账号信息无效');
  if (!Array.isArray(root.contributions)) throw new Error('用量接口缺少每日用量记录');
  const timestamp = updatedAt(root.updatedAt);
  const days = new Map<string, Day>();
  for (const value of root.contributions) {
    const contribution = record(value, '用量接口包含无效的日记录');
    const date = dateKey(contribution.date);
    if (!Array.isArray(contribution.clients)) throw new Error('用量接口缺少客户端分项，无法确认 Codex 用量');
    for (const value of contribution.clients) {
      const client = record(value, '用量接口包含无效的客户端分项');
      if (client.client !== 'codex') continue;
      const token = record(client.tokens, '用量接口缺少 Codex Token 分项');
      const input = counter(token.input), output = counter(token.output), cacheRead = counter(token.cacheRead), cacheWrite = counter(token.cacheWrite), reasoning = counter(token.reasoning);
      mergeDay(days, { date, tokens: counter(input + output + cacheRead + cacheWrite + reasoning), inputTokens: counter(input + cacheRead + cacheWrite), cachedInputTokens: cacheRead, outputTokens: counter(output + reasoning) });
    }
  }
  return { updatedAt: timestamp, source: `Tokscale · @${user.username} · Codex`, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

/** Also accepts the aggregate protocol returned by a configured third-party API. */
export function normalizeUsageResponse(value: unknown): NormalizedUsageSnapshot {
  const root = record(value, '用量接口返回格式不正确');
  if ('contributions' in root || 'user' in root || 'error' in root) return normalizeTokscaleUsage(root);
  if (!Array.isArray(root.days) || typeof root.source !== 'string' || !root.source.trim() || root.source.length > 300) throw new Error('用量接口缺少来源或每日用量记录');
  const days = new Map<string, Day>();
  for (const value of root.days) {
    const day = record(value, '用量接口包含无效的日记录');
    mergeDay(days, { date: dateKey(day.date), tokens: counter(day.tokens), inputTokens: counter(day.inputTokens ?? 0), cachedInputTokens: counter(day.cachedInputTokens ?? 0), outputTokens: counter(day.outputTokens ?? 0) });
  }
  return { updatedAt: updatedAt(root.updatedAt), source: root.source, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
