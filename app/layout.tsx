import 'katex/dist/katex.min.css';
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../components/ThemeProvider';
import BackgroundEffects from '../components/BackgroundEffects';
import { MusicProvider } from '../components/MusicProvider';
import BackgroundSlider from '../components/BackgroundSlider';
import ClickEffect from '../components/ClickEffect';
import MobileBackButton from '../components/MobileBackButton';
import { siteConfig } from '../siteConfig';

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.bio,
  icons: { icon: siteConfig.faviconUrl },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="w-full overflow-x-hidden min-h-full flex flex-col relative transition-colors duration-1000 bg-slate-50 dark:bg-slate-950 font-serif">
        <ThemeProvider>
          <MusicProvider>
            <div className="flex-1 flex flex-col">
              <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
                {!siteConfig.useGradient && <BackgroundSlider />}
                <div className="absolute inset-0 z-[-9] bg-white/30 dark:bg-slate-900/40 backdrop-blur-md transition-colors duration-1000" />
                <div className="absolute inset-0 z-[-8] opacity-60 dark:opacity-20 mix-blend-color transition-opacity duration-1000 transform-gpu" style={{ background: `linear-gradient(-45deg, ${siteConfig.themeColors.join(', ')})`, backgroundSize: '400% 400%', animation: 'gradientMove 15s ease infinite' }} />
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/40 dark:bg-indigo-900/20 blur-[100px] rounded-full z-[-7] md:mix-blend-overlay" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-purple-900/30 blur-[100px] rounded-full z-[-7] md:mix-blend-overlay" />
                <div className="hidden md:block absolute inset-0 w-full h-full"><BackgroundEffects /></div>
              </div>
              <div className="relative z-10 flex-1 flex flex-col">{children}</div>
              <div className="md:hidden block"><MobileBackButton /></div>
              <div className="hidden md:block"><ClickEffect /></div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: '@keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }' }} />
          </MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
