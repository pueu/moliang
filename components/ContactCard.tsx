'use client';
import { Mail, CodeXml, MessageCircle } from 'lucide-react';
import { siteConfig } from '../siteConfig';
import { useState } from 'react';

export default function ContactCard() {
  const [notice, setNotice] = useState('');
  const contacts = [
    { label: '邮箱', value: siteConfig.social.email, icon: Mail, href: siteConfig.social.email ? `mailto:${siteConfig.social.email}` : '' },
    { label: 'GitHub', value: siteConfig.social.github, icon: CodeXml, href: siteConfig.social.github },
    { label: 'QQ', value: siteConfig.social.qq, icon: MessageCircle, href: '' },
  ];
  async function copyQQ(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('QQ 号码已复制'); }
    catch { setNotice('无法自动复制，请手动复制 QQ：' + value); }
  }
  return (
    <section id="contact" className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 sm:p-8 flex flex-col h-full min-h-[280px] transition-all duration-700" aria-labelledby="contact-heading">
      <div className="flex justify-between items-center"><span className="text-xs tracking-[.18em] text-indigo-600 dark:text-indigo-300 font-bold">LET’S CONNECT</span><span className="text-purple-500 text-xl" aria-hidden="true">✧</span></div>
      <h2 id="contact-heading" className="text-2xl font-bold mt-2 mb-2 text-slate-900 dark:text-white">很高兴认识你</h2>
      <p className="text-base text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">一个新想法，一句问候，或只是聊聊日常。</p>
      <div className="flex flex-col gap-2 mt-auto">
        {contacts.map(({ label, value, icon: Icon, href }) => {
          const content = <><span className="flex items-center gap-3 shrink-0"><Icon className="w-5 h-5 text-indigo-500 dark:text-indigo-300" /><span className="font-bold text-sm">{label}</span></span><span className="text-sm text-slate-600 dark:text-slate-300 break-all text-right">{value || '稍后补充'}</span></>;
          const className = 'flex items-center justify-between gap-3 bg-white/40 dark:bg-slate-700/40 rounded-xl border border-white/40 dark:border-white/10 px-4 py-3 text-slate-800 dark:text-white hover:bg-white/60 dark:hover:bg-slate-600/40 transition-colors';
          return href ? <a key={label} href={href} target={label === 'GitHub' ? '_blank' : undefined} rel={label === 'GitHub' ? 'noopener noreferrer' : undefined} className={className}>{content}</a> : <button key={label} type="button" disabled={!value} aria-label={value ? '复制 QQ 号码' : `${label}，联系方式稍后补充`} onClick={() => copyQQ(value)} className={className + ' disabled:cursor-default'}>{content}</button>;
        })}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-indigo-600 dark:text-indigo-300 mt-2">{notice}</p>
    </section>
  );
}
