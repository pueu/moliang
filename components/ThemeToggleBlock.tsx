'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggleBlock() {
  const { isDark, toggleTheme } = useTheme();
  return <button type="button" aria-pressed={isDark} aria-label={isDark ? '切换到日间模式' : '切换到夜间模式'} title={isDark ? '日间模式' : '夜间模式'} onClick={toggleTheme} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/55 text-indigo-700 shadow-sm backdrop-blur-xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-indigo-400 dark:border-white/15 dark:bg-slate-800/75 dark:text-amber-200">
    {isDark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
  </button>;
}
