'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createSnake, stepSnake, turnSnake } from './snakeEngine';
import type { Direction } from './snakeEngine';
import { siteConfig } from '../siteConfig';

export interface UsageSnapshot {
  updatedAt: string;
  source: string;
  days: { date: string; tokens: number; inputTokens: number; cachedInputTokens: number; outputTokens: number }[];
}

type Day = UsageSnapshot['days'][number];
type Mode = 'daily' | 'weekly' | 'total';
const DAY_MS = 86_400_000;
const colors = ['#182431', '#163e61', '#12618b', '#188eb8', '#43d2e8'];
const number = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
const compact = (value: number) => value >= 100_000_000 ? `${(value / 100_000_000).toFixed(2)} 亿` : value >= 10_000 ? `${(value / 10_000).toFixed(1)} 万` : number(value);
const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Accept only public aggregate counters, never arbitrary API fields. */
export function validateUsageSnapshot(value: unknown): UsageSnapshot {
  if (!value || typeof value !== 'object') throw new Error('接口返回格式不正确');
  const root = value as Record<string, unknown>;
  if (typeof root.updatedAt !== 'string' || !Number.isFinite(Date.parse(root.updatedAt)) || typeof root.source !== 'string' || !Array.isArray(root.days)) throw new Error('接口缺少有效的更新时间或用量记录');
  const fields = ['tokens', 'inputTokens', 'cachedInputTokens', 'outputTokens'] as const;
  const days = root.days.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('接口包含无效的日记录');
    const day = value as Record<string, unknown>;
    if (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(dayTime(day.date)) || isoDate(dayTime(day.date)) !== day.date) throw new Error('接口包含无效日期');
    for (const field of fields) if (typeof day[field] !== 'number' || !Number.isFinite(day[field]) || (day[field] as number) < 0) throw new Error('接口包含无效的 Token 数量');
    return { date: day.date, tokens: day.tokens as number, inputTokens: day.inputTokens as number, cachedInputTokens: day.cachedInputTokens as number, outputTokens: day.outputTokens as number };
  });
  return { updatedAt: root.updatedAt, source: root.source, days };
}

function publicApiUrl(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) throw new Error('接口地址需使用 HTTPS，本机开发可使用 localhost HTTP');
  return url.href;
}

function snapshotDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '1970-01-01';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function buildUsage(data: UsageSnapshot) {
  const today = snapshotDate(data.updatedAt);
  const end = dayTime(today);
  const weekStart = end - new Date(end).getUTCDay() * DAY_MS;
  const start = weekStart - 52 * 7 * DAY_MS;
  const map = new Map<string, Day>();
  for (const day of data.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || day.date > today) continue;
    const previous = map.get(day.date);
    const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
    map.set(day.date, {
      date: day.date,
      tokens: (previous?.tokens || 0) + safe(day.tokens),
      inputTokens: (previous?.inputTokens || 0) + safe(day.inputTokens),
      cachedInputTokens: (previous?.cachedInputTokens || 0) + safe(day.cachedInputTokens),
      outputTokens: (previous?.outputTokens || 0) + safe(day.outputTokens),
    });
  }
  const weeks = Array.from({ length: 53 }, (_, week) => {
    const dates = Array.from({ length: 7 }, (_, row) => isoDate(start + (week * 7 + row) * DAY_MS));
    const recorded = dates.map(date => map.get(date)).filter((day): day is Day => !!day);
    return { dates, tokens: recorded.reduce((sum, day) => sum + day.tokens, 0), count: recorded.length };
  });
  let cumulative = [...map.values()].filter(day => day.date < isoDate(start)).reduce((sum, day) => sum + day.tokens, 0);
  const totals = new Map<string, number>();
  for (const week of weeks) for (const date of week.dates) {
    cumulative += map.get(date)?.tokens || 0;
    totals.set(date, cumulative);
  }
  return { today, map, weeks, totals, total: [...map.values()].reduce((sum, day) => sum + day.tokens, 0) };
}

export default function CodexUsage({ data, apiUrl }: { data: UsageSnapshot; apiUrl?: string }) {
  const endpoint = (apiUrl ?? process.env.NEXT_PUBLIC_CODEX_USAGE_API_URL ?? siteConfig.usageApiUrl ?? '').trim();
  const [refresh, setRefresh] = useState(0);
  const [request, setRequest] = useState<{ endpoint: string; snapshot: UsageSnapshot | null; loading: boolean; error: string | null }>({ endpoint, snapshot: null, loading: !!endpoint, error: null });
  const activeRequest = request.endpoint === endpoint ? request : null;
  const snapshot = activeRequest?.snapshot ?? data;
  const usage = useMemo(() => buildUsage(snapshot), [snapshot]);
  const [mode, setMode] = useState<Mode>('daily');
  const [selected, setSelected] = useState<string | null>(null);
  const [game, setGame] = useState(false);
  const [snake, setSnake] = useState(createSnake);
  const gameRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const helpId = useId();
  const tabId = useId();
  const statusText = { ready: '准备好了 · 点击开始', running: '游戏进行中', paused: '已暂停 · 点击继续', over: '游戏结束 · 再试一次', won: '完成整个网格！' }[snake.status];
  const currentWeek = usage.weeks[52];
  const todayRecord = usage.map.get(usage.today);
  const displayed = mode === 'daily' ? todayRecord?.tokens : mode === 'weekly' ? (currentWeek.count ? currentWeek.tokens : undefined) : (usage.map.size ? usage.total : undefined);
  const metricsLabel = mode === 'daily' ? '今天的用量' : mode === 'weekly' ? '本周已记录用量' : '全部已记录用量';
  const values = usage.weeks.flatMap(week => week.dates.filter(date => date <= usage.today).map(date => mode === 'daily' ? (usage.map.get(date)?.tokens || 0) : mode === 'weekly' ? week.tokens : (usage.totals.get(date) || 0)));
  const maximum = Math.max(1, ...values);
  const intensity = (tokens: number) => !tokens ? 0 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(tokens / maximum) * 4)));
  const selectedDay = selected ? usage.map.get(selected) : undefined;
  const selectedWeek = selected ? usage.weeks.find(week => week.dates.includes(selected)) : undefined;
  const occupied = new Set(snake.snake.map(point => `${point.x},${point.y}`));
  const buttonClass = 'rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300';

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
    // Defer loading state to the asynchronous request, including in Strict Mode.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setRequest(previous => ({ endpoint, snapshot: previous.endpoint === endpoint ? previous.snapshot : null, loading: true, error: null }));
      try {
        const response = await fetch(publicApiUrl(endpoint), { signal: controller.signal, credentials: 'omit', mode: 'cors', cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`接口响应 HTTP ${response.status}`);
        const next = validateUsageSnapshot(await response.json());
        if (!cancelled) setRequest({ endpoint, snapshot: next, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setRequest(previous => ({ endpoint, snapshot: previous.endpoint === endpoint ? previous.snapshot : null, loading: false, error: timedOut ? '接口请求超时' : error instanceof TypeError ? '接口暂不可用，请检查网络与 CORS 配置' : error instanceof Error ? error.message : '接口暂不可用' }));
      } finally {
        window.clearTimeout(timeout);
      }
    });
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort(); };
  }, [endpoint, refresh]);

  useEffect(() => {
    if (!endpoint) return;
    const timer = window.setInterval(() => { if (!document.hidden) setRefresh(value => value + 1); }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [endpoint]);

  useEffect(() => {
    if (!game || snake.status !== 'running') return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const random = Math.random();
      setSnake(previous => stepSnake(previous, random));
    }, 160);
    return () => window.clearInterval(timer);
  }, [game, snake.status]);

  useEffect(() => {
    const pause = () => setSnake(previous => previous.status === 'running' ? { ...previous, pending: null, status: 'paused' } : previous);
    const visibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', pause);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', pause); };
  }, []);

  useEffect(() => { if (game) gameRef.current?.focus(); }, [game]);

  function openGame() {
    setSelected(null);
    setSnake(createSnake());
    setGame(true);
  }
  function play() {
    setSnake(previous => previous.status === 'over' || previous.status === 'won' ? { ...createSnake(), status: 'running' } : { ...previous, pending: null, status: 'running' });
    gameRef.current?.focus();
  }
  function direction(next: Direction) {
    setSnake(previous => turnSnake(previous.status === 'ready' ? { ...previous, status: 'running' } : previous, next));
    gameRef.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keys[key]) { event.preventDefault(); direction(keys[key]); }
    if (event.key === ' ' && event.target === event.currentTarget) {
      event.preventDefault();
      if (snake.status === 'running') setSnake(previous => ({ ...previous, pending: null, status: 'paused' }));
      else play();
    }
  }

  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-3xl border border-white/40 bg-white/40 p-5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50 sm:p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-600 dark:text-cyan-400">CODEX / ACTIVITY</p>
          <h2 id={headingId} className="text-xl font-bold text-slate-900 dark:text-white">把灵感写进每一天</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">真实 Token 活动记录 · 点击网格，来一局贪吃蛇</p>
        </div>
        {!game && <button onClick={openGame} className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-500/20 focus-visible:outline-2 focus-visible:outline-cyan-400 dark:text-cyan-300">玩贪吃蛇 ↗</button>}
      </div>

      <div className="min-w-0 rounded-2xl border border-white/10 bg-[#090f19] p-4 text-slate-200 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 text-[10px] text-slate-500">
          <div role="status" aria-live="polite"><span className={activeRequest?.error ? 'text-amber-300' : activeRequest?.snapshot ? 'text-cyan-300' : 'text-slate-400'}>{activeRequest?.loading ? '正在读取外部接口' : activeRequest?.error ? `${activeRequest.error} · ${activeRequest.snapshot ? '保留上次接口记录' : '使用本机记录快照'}` : activeRequest?.snapshot ? '外部接口 · 每 5 分钟更新' : '本机记录快照'}</span><span className="ml-2">更新时间 {snapshotDate(snapshot.updatedAt)} {snapshot.updatedAt.includes('T') ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(snapshot.updatedAt)) : ''}（上海时间）</span></div>
          {!!endpoint && <button className="rounded px-2 py-1 text-cyan-300 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-40" disabled={activeRequest?.loading} onClick={() => setRefresh(value => value + 1)}>刷新用量</button>}
          <p className="w-full text-slate-600">统计已记录的 Token 活动，不表示账户剩余额度。</p>
        </div>
        {!game ? <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div><span className="text-[11px] text-slate-400">{metricsLabel}</span><p className="mt-1 text-2xl font-semibold tracking-tight text-white">{displayed === undefined ? '未记录' : compact(displayed)}{displayed !== undefined && <span className="ml-2 text-xs font-normal text-slate-500">tokens</span>}</p></div>
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Codex 用量统计周期">
              {([['daily', '每天'], ['weekly', '每周'], ['total', '累计总量']] as const).map(([value, label]) => <button key={value} id={`${tabId}-${value}`} role="tab" aria-selected={mode === value} aria-controls={`${tabId}-panel`} tabIndex={mode === value ? 0 : -1} onKeyDown={event => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const modes: Mode[] = ['daily', 'weekly', 'total'];
                  const next = modes[(modes.indexOf(mode) + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
                  setMode(next);
                  document.getElementById(`${tabId}-${next}`)?.focus();
                }
              }} onClick={() => setMode(value)} className={`rounded-md px-3 py-1.5 text-xs transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${mode === value ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-500 hover:text-slate-200'}`}>{label}</button>)}
            </div>
          </div>

          <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${mode}`}>
            <div className="max-w-full overflow-x-auto pb-3" aria-label="过去 53 周用量网格，可横向滚动" tabIndex={0}>
              <div style={{ minWidth: 660 }}>
                <div className="mb-2 grid pl-6 text-[10px] text-slate-500" style={{ gridTemplateColumns: 'repeat(53, minmax(0, 1fr))' }}>{usage.weeks.map((week, index) => {
                  const date = week.dates[0];
                  const previous = usage.weeks[index - 1]?.dates[0];
                  const label = index === 0 || date.slice(0, 7) !== previous?.slice(0, 7) ? `${Number(date.slice(5, 7))}月` : '';
                  return <span key={date} className="whitespace-nowrap">{label}</span>;
                })}</div>
                <div className="flex gap-2">
                  <div className="grid w-4 shrink-0 grid-rows-7 text-[9px] text-slate-600" style={{ gap: 3 }} aria-hidden="true">{['日', '', '二', '', '四', '', '六'].map((label, index) => <span key={index} className="flex items-center">{label}</span>)}</div>
                  <div className="grid flex-1" style={{ gridTemplateColumns: 'repeat(53, minmax(0, 1fr))', gap: 3 }}>
                    {usage.weeks.map(week => <div key={week.dates[0]} className="grid grid-rows-7" style={{ gap: 3 }}>{week.dates.map(date => {
                      const future = date > usage.today;
                      const day = usage.map.get(date);
                      const recorded = mode === 'daily' ? !!day : mode === 'weekly' ? week.count > 0 : usage.map.size > 0 && (usage.totals.get(date) || 0) > 0;
                      const tokens = mode === 'daily' ? (day?.tokens || 0) : mode === 'weekly' ? week.tokens : (usage.totals.get(date) || 0);
                      const label = `${date}，${day ? `${number(day.tokens)} tokens` : '未记录'}；点击玩贪吃蛇`;
                      if (future) return <span key={date} className="aspect-square rounded-[2px] bg-white/[0.02]" aria-hidden="true" />;
                      return <button key={date} type="button" aria-label={label} onMouseEnter={() => setSelected(date)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(date)} onBlur={() => setSelected(null)} onClick={openGame} className="aspect-square rounded-[2px] transition hover:scale-125 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white" style={{ backgroundColor: recorded ? colors[intensity(tokens)] : '#111b27', boxShadow: recorded ? undefined : 'inset 0 0 0 1px #253040' }} />;
                    })}</div>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>{mode === 'daily' ? '每格一天 · 总 tokens（含缓存输入）' : mode === 'weekly' ? '每列一周 · 全列显示该周已记录合计' : '每格显示截至该日的已记录累计用量'}</span><div className="flex items-center gap-1.5"><span>少</span>{colors.map(color => <span key={color} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />)}<span>多</span><span className="ml-2 h-2.5 w-2.5 rounded-[2px] border border-slate-700 bg-[#111b27]" /><span>未记录</span></div></div>
            <div role="status" aria-live="polite" className="mt-4 min-h-[66px] rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
              {selected ? <><strong className="font-medium text-slate-200">{selected}</strong>{mode === 'weekly' && selectedWeek && <span> · {selectedWeek.dates[0]} 至 {selectedWeek.dates[6] > usage.today ? usage.today : selectedWeek.dates[6]}：{selectedWeek.count ? `${number(selectedWeek.tokens)} tokens（已记录 ${selectedWeek.count} 天）` : '未记录'}</span>}{mode === 'total' && <span> · 截至当日累计 {number(usage.totals.get(selected) || 0)} tokens</span>}<br />{selectedDay ? <span>当天 {number(selectedDay.tokens)} tokens（含缓存输入）</span> : <span>当天未记录 · 缺失记录不代表用量为零</span>}</> : <><span>鼠标悬停或键盘聚焦查看当天记录。</span><br /><span>更新至 {usage.today}（上海时间） · {activeRequest?.snapshot ? '外部接口记录' : '本机记录快照'}</span></>}
            </div>
          </div>
        </> : <div ref={gameRef} tabIndex={0} onKeyDown={keyDown} onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSnake(previous => previous.status === 'running' ? { ...previous, pending: null, status: 'paused' } : previous);
        }} role="group" aria-label="网格贪吃蛇游戏" aria-describedby={helpId} data-game-state={snake.status} data-score={snake.score} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400">SNAKE / GRID</span><p className="mt-1 text-sm font-medium text-white">贪吃蛇 <span className="ml-3 text-cyan-300">{snake.score.toString().padStart(2, '0')} 分</span></p></div><button className={buttonClass} onClick={() => { setGame(false); setSnake(createSnake()); }}>← 返回用量</button></div>
          <div className="relative overflow-hidden rounded-lg border border-white/5 bg-[#0c1521] p-2">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${snake.width}, minmax(0, 1fr))`, gap: 3 }} aria-hidden="true">
              {Array.from({ length: snake.width * snake.height }, (_, index) => {
                const x = index % snake.width;
                const y = Math.floor(index / snake.width);
                const head = snake.snake[0].x === x && snake.snake[0].y === y;
                const body = occupied.has(`${x},${y}`);
                const food = snake.food?.x === x && snake.food?.y === y;
                return <span key={index} className="aspect-square rounded-[2px]" style={{ backgroundColor: head ? '#c7f9ff' : body ? '#24b8d7' : food ? '#fbbf24' : '#182431', boxShadow: food ? '0 0 9px #fbbf2460' : head ? '0 0 8px #43d2e860' : undefined }} />;
              })}
            </div>
            {snake.status !== 'running' && <div className="absolute inset-0 flex items-center justify-center bg-[#090f19]/60 backdrop-blur-[2px]"><div className="text-center"><p className="text-sm font-semibold text-white">{statusText}</p><button onClick={play} className="mt-3 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-white">{snake.status === 'paused' ? '继续游戏' : snake.status === 'ready' ? '开始游戏' : '再玩一次'}</button></div></div>}
          </div>
          <p role="status" aria-live="polite" className="mt-3 text-xs text-cyan-300">{statusText}</p>
          <p id={helpId} className="mt-1 text-[11px] text-slate-500">方向键 / WASD 移动 · 空格暂停 · 吃掉金色方块 · 撞墙或身体结束</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2"><button className={buttonClass} disabled={snake.status !== 'running' && snake.status !== 'paused'} onClick={() => { if (snake.status === 'running') setSnake(previous => ({ ...previous, pending: null, status: 'paused' })); else play(); }} style={{ opacity: snake.status === 'running' || snake.status === 'paused' ? 1 : 0.4 }}>{snake.status === 'paused' ? '继续' : '暂停'}</button><button className={buttonClass} onClick={() => { setSnake(createSnake()); gameRef.current?.focus(); }}>重新开始</button></div>
            <div className="grid grid-cols-3 gap-1.5" aria-label="触屏方向控制"><span /><button className={buttonClass} aria-label="向上移动" onClick={() => direction('up')}>↑</button><span /><button className={buttonClass} aria-label="向左移动" onClick={() => direction('left')}>←</button><button className={buttonClass} aria-label="向下移动" onClick={() => direction('down')}>↓</button><button className={buttonClass} aria-label="向右移动" onClick={() => direction('right')}>→</button></div>
          </div>
        </div>}
      </div>
    </section>
  );
}
