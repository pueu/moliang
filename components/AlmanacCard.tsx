'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Solar } from 'lunar-typescript';

function shanghaiToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const field = (type: string) => parts.find(part => part.type === type)?.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}

export default function AlmanacCard() {
  const [today, setToday] = useState('');
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const refresh = () => setToday(shanghaiToday());
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 60000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);
  const almanac = useMemo(() => {
    if (!today) return null;
    const [year, month, day] = today.split('-').map(Number);
    const solar = Solar.fromYmd(year, month, day).next(offset);
    const lunar = solar.getLunar();
    return {
      date: solar.toYmd(), day: solar.getDay(), month: solar.getMonth(), week: solar.getWeekInChinese(),
      lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      year: `${lunar.getYearInGanZhi()}${lunar.getYearShengXiao()}年`,
      festival: [lunar.getJieQi(), ...lunar.getFestivals(), ...solar.getFestivals()].filter(Boolean).join(' · '),
      yi: lunar.getDayYi(), ji: lunar.getDayJi(),
    };
  }, [today, offset]);
  const control = 'flex h-8 w-8 items-center justify-center rounded-lg bg-white/35 transition hover:bg-white/65 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:bg-white/5 dark:hover:bg-white/10';
  return <section aria-label="黄历" data-testid="almanac-card" data-date={almanac?.date} className="relative flex h-full min-h-[250px] flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/45 p-4 text-slate-800 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-100">
    <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-300"><span className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />黄历</span><span>{almanac ? `${almanac.month}月 · 星期${almanac.week}` : '农历日历'}</span></div>
    {almanac ? <>
      <div className="my-3 flex items-center justify-between gap-2"><span className="text-5xl font-semibold tracking-tighter text-slate-900 dark:text-white">{String(almanac.day).padStart(2, '0')}</span><div className="text-right"><p className="text-sm font-semibold">{almanac.lunar}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{almanac.year}</p></div></div>
      {almanac.festival && <p className="mb-2 text-xs text-amber-700 dark:text-amber-200">{almanac.festival}</p>}
      <div className="space-y-2 border-t border-white/30 pt-3 dark:border-white/10">
        <p className="flex gap-2 text-sm leading-6" title={almanac.yi.join('、')}><span className="shrink-0 font-bold text-emerald-700 dark:text-emerald-300">宜</span><span>{almanac.yi.slice(0, 3).join(' · ') || '无'}</span></p>
        <p className="flex gap-2 text-sm leading-6" title={almanac.ji.join('、')}><span className="shrink-0 font-bold text-rose-600 dark:text-rose-300">忌</span><span>{almanac.ji.slice(0, 3).join(' · ') || '无'}</span></p>
      </div>
    </> : <p className="my-auto text-center text-sm text-slate-500">正在载入日历</p>}
    <div className="mt-auto flex items-center justify-between gap-1 pt-3"><button type="button" className={control} aria-label="黄历前一天" onClick={() => setOffset(value => Math.max(-365, value - 1))}><ChevronLeft size={16} aria-hidden="true" /></button><button type="button" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-500/10 dark:text-indigo-300" onClick={() => setOffset(0)}>{offset === 0 ? '今天' : '回到今天'}</button><button type="button" className={control} aria-label="黄历后一天" onClick={() => setOffset(value => Math.min(365, value + 1))}><ChevronRight size={16} aria-hidden="true" /></button></div>
  </section>;
}
