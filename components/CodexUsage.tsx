'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { createSnake, stepSnake, turnSnake } from './snakeEngine';
import type { Direction } from './snakeEngine';
import { buildDemoView, DEMO_START, generateDemoUsage, shanghaiDate } from './demoUsage';
import { formatTokens, getWeekUsage } from './usageSummary';

type Mode = 'daily' | 'weekly' | 'total';
const DAY_MS = 86_400_000;
const colors = ['#182431', '#163e61', '#12618b', '#188eb8', '#43d2e8'];
const CELL_SIZE = 11;
const CELL_GAP = 4;

export default function CodexUsage() {
  const [today, setToday] = useState('');
  const [period, setPeriod] = useState('all');
  const snapshot = useMemo(() => today ? generateDemoUsage(today) : null, [today]);
  const usage = useMemo(() => buildDemoView(snapshot, period), [snapshot, period]);
  const columns = Math.max(1, usage.weeks.length);
  const gridColumns = `repeat(${columns}, ${CELL_SIZE}px)`;
  const gridRef = useRef<HTMLDivElement>(null);
  const years = snapshot ? Array.from({ length: Math.max(0, Number(snapshot.cutoff.slice(0, 4)) - Number(DEMO_START.slice(0, 4)) + 1) }, (_, index) => String(Number(snapshot.cutoff.slice(0, 4)) - index)) : [];
  const [mode, setMode] = useState<Mode>('daily');
  const [selected, setSelected] = useState<{ date: string; left: number; right: number; top: number; bottom: number } | null>(null);
  const [game, setGame] = useState(false);
  const [snake, setSnake] = useState(createSnake);
  const gameRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const helpId = useId();
  const tabId = useId();
  const tooltipId = useId();
  const statusText = { ready: '准备好了 · 点击开始', running: '游戏进行中', paused: '已暂停 · 点击继续', over: '游戏结束 · 再试一次', won: '完成整个网格！' }[snake.status];
  const currentWeek = getWeekUsage(snapshot?.days ?? [], today || DEMO_START);
  const displayed = currentWeek.tokens;
  const values = usage.weeks.flatMap(week => week.dates.filter(date => date < usage.today).map(date => mode === 'daily' ? (usage.map.get(date)?.tokens || 0) : mode === 'weekly' ? week.tokens : (usage.totals.get(date) || 0)));
  const maximum = Math.max(1, ...values);
  const intensity = (tokens: number) => !tokens ? 0 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(tokens / maximum) * 4)));
  const selectedDay = selected ? usage.map.get(selected.date) : undefined;
  const selectedWeek = selected ? usage.weeks.find(week => week.dates.includes(selected.date)) : undefined;
  const occupied = new Set(snake.snake.map(point => `${point.x},${point.y}`));
  const buttonClass = 'rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300';

  useEffect(() => {
    let timer: number;
    const refresh = () => {
      const now = new Date();
      const date = shanghaiDate(now);
      setToday(date);
      const midnight = Date.parse(`${date}T00:00:00+08:00`) + DAY_MS;
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, Math.min(60000, Math.max(50, midnight - now.getTime() + 50)));
    };
    const resume = () => { if (!document.hidden) refresh(); };
    refresh();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, []);

  useEffect(() => {
    const element = gridRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
    setSelected(null);
  }, [period, today, game]);

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

  useEffect(() => {
    if (!selected) return;
    const dismiss = () => setSelected(null);
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    // Dismiss on scrolling, including the horizontally scrollable heatmap.
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', escape);
    };
  }, [selected]);

  function showUsage(date: string, element: HTMLButtonElement) {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    setSelected({ date, left, right, top, bottom });
  }

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
    <section data-testid="codex-usage" data-usage-source="demo" data-today={today} aria-labelledby={headingId} className="min-w-0 rounded-3xl border border-white/40 bg-white/40 p-5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-600 dark:text-cyan-400">CODEX / ACTIVITY</p>
          <h2 id={headingId} className="text-xl font-bold text-slate-900 dark:text-white">把灵感写进每一天</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">随机演示 Token 活动 · 点击网格，来一局贪吃蛇</p>
        </div>
        {!game && <button onClick={openGame} className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-500/20 focus-visible:outline-2 focus-visible:outline-cyan-400 dark:text-cyan-300">玩贪吃蛇 ↗</button>}
      </div>

      <div className="min-w-0 rounded-2xl border border-white/10 bg-[#090f19] p-4 text-slate-200 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 text-[10px] text-slate-500">
          <div role="status" aria-live="polite"><span className="text-cyan-300">随机演示数据 · 非真实账户用量</span>{snapshot && <span className="ml-2">截至 {snapshot.cutoff} · 上海时间</span>}</div>
          <p className="w-full text-slate-500">每日 3000 万～10 亿 token · 网站自动按日期补齐，今天和未来不计入。</p>
        </div>
        {!game ? !snapshot ? <div className="flex min-h-[210px] items-center justify-center text-sm text-slate-400" data-usage-state="loading">正在生成演示历史…        </div> : <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div><span className="text-[11px] text-slate-400">本周演示用量</span><p className="mt-1 text-2xl font-semibold tracking-tight text-white">{formatTokens(displayed)}</p><p className="mt-1 text-[10px] text-slate-500">{currentWeek.start.slice(5)} 至 {currentWeek.end.slice(5)} · 上海时间 · 已生成 {currentWeek.recordedDays} 天</p></div>
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

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>历史范围 {DEMO_START} 至 {usage.cutoff} · 共 {snapshot.days.length.toLocaleString('zh-CN')} 天 · 累计 {formatTokens(usage.total)}</span>
            <label className="flex items-center gap-2">展示范围<select aria-label="用量展示范围" value={period} onChange={event => setPeriod(event.target.value)} className="rounded border border-white/15 bg-[#111b27] px-2 py-1 text-slate-200 focus-visible:outline-2 focus-visible:outline-cyan-300"><option value="all">全部历史</option>{years.map(year => <option key={year} value={year}>{year} 年</option>)}</select></label>
          </div>
          <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${mode}`}>
            <div ref={gridRef} data-testid="usage-grid" className="max-w-full overflow-x-auto pb-3" aria-label="历史演示用量网格，可横向滚动查看全部日期" tabIndex={0}>
              <div style={{ width: 24 + columns * CELL_SIZE + (columns - 1) * CELL_GAP }}>
                <div className="mb-2 grid pl-6 text-[10px] text-slate-500" style={{ gridTemplateColumns: gridColumns, gap: CELL_GAP }}>{usage.weeks.map((week, index) => {
                  const date = week.dates[0];
                  const previous = usage.weeks[index - 1]?.dates[0];
                  const label = index === 0 || date.slice(0, 7) !== previous?.slice(0, 7) ? `${Number(date.slice(5, 7))}月` : '';
                  return <span key={date} className="whitespace-nowrap">{label}</span>;
                })}</div>
                <div className="flex gap-2">
                  <div className="grid w-4 shrink-0 text-[9px] text-slate-600" style={{ gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`, gap: CELL_GAP }} aria-hidden="true">{['一', '', '三', '', '五', '', '日'].map((label, index) => <span key={index} className="flex items-center">{label}</span>)}</div>
                  <div className="grid" style={{ gridTemplateColumns: gridColumns, gap: CELL_GAP }}>
                    {usage.weeks.map(week => <div key={week.dates[0]} className="grid" style={{ gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`, gap: CELL_GAP }}>{week.dates.map(date => {
                      const future = date >= usage.today || date < DEMO_START || date < usage.first || date > usage.last;
                      const day = usage.map.get(date);
                      const recorded = mode === 'daily' ? !!day : mode === 'weekly' ? week.count > 0 : usage.map.size > 0 && (usage.totals.get(date) || 0) > 0;
                      const tokens = mode === 'daily' ? (day?.tokens || 0) : mode === 'weekly' ? week.tokens : (usage.totals.get(date) || 0);
                      const label = `${date}，${recorded ? formatTokens(tokens) : '未记录'}；点击玩贪吃蛇`;
                      if (future) return <span key={date} className="rounded-[3px] bg-white/[0.02]" style={{ width: CELL_SIZE, height: CELL_SIZE }} aria-hidden="true" />;
                      return <button key={date} type="button" data-usage-date={date} data-tokens={tokens} aria-label={label} aria-describedby={selected?.date === date ? tooltipId : undefined} onMouseEnter={event => showUsage(date, event.currentTarget)} onMouseLeave={() => setSelected(null)} onFocus={event => showUsage(date, event.currentTarget)} onBlur={() => setSelected(null)} onClick={openGame} className="rounded-[3px] transition hover:outline hover:outline-1 hover:outline-cyan-200 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white" style={{ width: CELL_SIZE, height: CELL_SIZE, padding: 0, minWidth: 0, backgroundColor: recorded ? colors[intensity(tokens)] : '#111b27', boxShadow: recorded ? undefined : 'inset 0 0 0 1px #253040' }} />;
                    })}</div>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>{mode === 'daily' ? '每格一天 · 随机演示 tokens' : mode === 'weekly' ? '每列一周 · 该周已结束日期的演示合计' : '每格显示截至该日的全部演示累计用量'}</span><div className="flex items-center gap-1.5"><span>少</span>{colors.map(color => <span key={color} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />)}<span>多</span><span className="ml-2 h-2.5 w-2.5 rounded-[2px] border border-slate-700 bg-[#111b27]" /><span>未记录</span></div></div>
            {selected && createPortal(
              <div id={tooltipId} role="tooltip" ref={element => {
                if (!element) return;
                const { width, height } = element.getBoundingClientRect();
                const left = Math.max(8, Math.min((selected.left + selected.right - width) / 2, window.innerWidth - width - 8));
                const above = selected.top - height - 8;
                const top = above >= 8 ? above : Math.min(selected.bottom + 8, window.innerHeight - height - 8);
                element.style.left = `${left}px`;
                element.style.top = `${Math.max(8, top)}px`;
              }} className="pointer-events-none fixed z-[100] w-max max-w-[calc(100vw-16px)] rounded-xl border border-white/15 bg-[#24272d] px-3 py-2 text-sm leading-snug text-white shadow-xl">
                <p className="font-medium">{mode === 'weekly' && selectedWeek ? `${selectedWeek.dates[0]} 至 ${selectedWeek.dates[6] > usage.cutoff ? usage.cutoff : selectedWeek.dates[6]}` : `${selected.date} ${mode === 'total' ? '累计' : ''}`}</p>
                <p className="mt-0.5 text-cyan-200">{mode === 'weekly' ? selectedWeek?.count ? formatTokens(selectedWeek.tokens) : '未记录' : mode === 'total' ? formatTokens(usage.totals.get(selected.date) || 0) : selectedDay ? formatTokens(selectedDay.tokens) : '未记录'}</p>
              </div>, document.body,
            )}
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
