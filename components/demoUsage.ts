/** Decorative, deterministic demo data. No account or usage API is consulted. */
export const DEMO_START = '2020-01-01';
export const DEMO_MIN = 30_000_000;
export const DEMO_MAX = 1_000_000_000;
const DAY_MS = 86_400_000;
const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10);

export interface DemoUsageSnapshot {
  today: string;
  cutoff: string;
  source: 'demo';
  days: { date: string; tokens: number }[];
}

export function shanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const field = (type: string) => parts.find(part => part.type === type)!.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}

function validateDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dayTime(date)) || dateKey(dayTime(date)) !== date) throw new RangeError('Invalid calendar date');
}

export function demoTokens(date: string): number {
  // Versioned date seed: old records stay identical after refresh and rollover.
  let hash = 2166136261;
  for (const char of `moliang-demo-v1:${date}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return DEMO_MIN + Math.floor((hash >>> 0) / 4294967296 * (DEMO_MAX - DEMO_MIN + 1));
}

export function generateDemoUsage(today: string): DemoUsageSnapshot {
  validateDate(today);
  const end = dayTime(today);
  const days: DemoUsageSnapshot['days'] = [];
  for (let time = dayTime(DEMO_START); time < end; time += DAY_MS) {
    const date = dateKey(time);
    days.push({ date, tokens: demoTokens(date) });
  }
  return { today, cutoff: dateKey(end - DAY_MS), source: 'demo', days };
}

export function buildDemoView(snapshot: DemoUsageSnapshot | null, period = 'all') {
  const map = new Map<string, DemoUsageSnapshot['days'][number]>();
  if (snapshot) for (const day of snapshot.days) if (day.date >= DEMO_START && day.date < snapshot.today) map.set(day.date, day);
  const today = snapshot?.today || '';
  const cutoff = snapshot?.cutoff || '';
  const year = /^\d{4}$/.test(period) ? period : null;
  const first = year ? `${year}-01-01` : DEMO_START;
  const last = year && `${year}-12-31` < cutoff ? `${year}-12-31` : cutoff;
  const firstTime = dayTime(first);
  const start = firstTime - ((new Date(firstTime).getUTCDay() + 6) % 7) * DAY_MS;
  const columns = !cutoff || last < first ? 0 : Math.floor((dayTime(last) - start) / (7 * DAY_MS)) + 1;
  const weeks = Array.from({ length: columns }, (_, week) => {
    const dates = Array.from({ length: 7 }, (_, row) => dateKey(start + (week * 7 + row) * DAY_MS));
    const recorded = dates.map(date => map.get(date)).filter((day): day is DemoUsageSnapshot['days'][number] => !!day);
    return { dates, tokens: recorded.reduce((sum, day) => sum + day.tokens, 0), count: recorded.length };
  });
  let cumulative = [...map.values()].filter(day => day.date < dateKey(start)).reduce((sum, day) => sum + day.tokens, 0);
  const totals = new Map<string, number>();
  for (const week of weeks) for (const date of week.dates) {
    cumulative += map.get(date)?.tokens || 0;
    if (date < today) totals.set(date, cumulative);
  }
  return { today, cutoff, first, last, map, weeks, totals, total: [...map.values()].reduce((sum, day) => sum + day.tokens, 0) };
}
