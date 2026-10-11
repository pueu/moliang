export function formatTokens(value: number): string {
  const tokens = Math.max(0, value);
  if (tokens >= 99_995_000) return `${(tokens / 100_000_000).toFixed(1)}亿token`;
  if (tokens >= 10_000) return `${(tokens / 10_000).toFixed(1)}万token`;
  return `${Math.round(tokens)}token`;
}

/** Date keys are calendar dates in Shanghai; weeks run Monday through Sunday. */
export function getWeekUsage(days: readonly { date: string; tokens: number }[], today: string) {
  const dayMs = 86_400_000;
  const time = Date.parse(`${today}T00:00:00Z`);
  const startTime = time - ((new Date(time).getUTCDay() + 6) % 7) * dayMs;
  const dateKey = (value: number) => new Date(value).toISOString().slice(0, 10);
  const start = dateKey(startTime);
  const end = dateKey(startTime + 6 * dayMs);
  const records = days.filter(day => day.date >= start && day.date <= today && Number.isFinite(day.tokens) && day.tokens >= 0);
  return { start, end, tokens: records.reduce((sum, day) => sum + day.tokens, 0), recordedDays: new Set(records.map(day => day.date)).size };
}
