'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { publicPath } from '../../siteConfig';
import { toyCharacters, type ToyCharacterId } from '../../data/toyCharacters';
import { DAILY_DRAWS, GACHA_KEY, readGacha, saveDraw, type GachaState } from './gachaState';
import ToyDialog from './ToyDialog';
import ToyCollection from './ToyCollection';
import styles from './toys.module.css';

type Phase = 'idle' | 'turning' | 'dropping' | 'opening';
export default function GachaMachine() {
  const [state, setState] = useState<GachaState | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'collection' | ToyCharacterId | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const knob = useRef<HTMLButtonElement>(null);
  const collectionButton = useRef<HTMLButtonElement>(null);
  const timeouts = useRef<number[]>([]);
  const remaining = state ? DAILY_DRAWS - state.used : 0;
  const collected = state ? Object.keys(state.collection).length : 0;

  function refresh() {
    try { setState(readGacha(localStorage.getItem(GACHA_KEY))); setError(''); }
    catch { setError('收藏暂时无法读取，请允许本站保存数据后重试。现有记录不会被覆盖。'); }
  }
  useEffect(() => {
    mounted.current = true;
    refresh();
    const storage = (event: StorageEvent) => { if (event.key === GACHA_KEY || event.key === null) refresh(); };
    const visibility = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(visibility, 15000);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    return () => { mounted.current = false; clearInterval(timer); timeouts.current.forEach(clearTimeout); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  const wait = (ms: number) => new Promise<void>(resolve => { timeouts.current.push(window.setTimeout(resolve, ms)); });
  async function draw() {
    if (busy.current || !state || remaining <= 0 || error) return;
    busy.current = true;
    setPhase('turning');
    setError('');
    try {
      const next = await saveDraw();
      if (!mounted.current) return;
      setState(next);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      await wait(reduced ? 30 : 420);
      if (!mounted.current) return;
      setPhase('dropping');
      await wait(reduced ? 30 : 520);
      if (!mounted.current) return;
      setPhase('opening');
      await wait(reduced ? 30 : 380);
      if (!mounted.current) return;
      setDialog(next.lastDraw!.characterId);
    } catch (reason) {
      if (!mounted.current) return;
      try { setState(readGacha(localStorage.getItem(GACHA_KEY))); } catch { /* preserve last visible collection */ }
      setError(reason instanceof Error && /今天|另一个|收藏/.test(reason.message) ? reason.message : '收藏未能保存，请允许本站保存数据后重试。本次未确认抽取成功。');
    } finally {
      busy.current = false;
      if (mounted.current) setPhase('idle');
    }
  }
  const result = toyCharacters.find(character => character.id === dialog);
  function closeDialog() { setDialog(null); if (result) requestAnimationFrame(() => (knob.current?.disabled ? collectionButton.current : knob.current)?.focus({ preventScroll: true })); }

  return <section className={`${styles.panel} ${styles.gachaPanel}`} aria-labelledby="gacha-title" data-testid="gacha-machine" data-phase={phase}>
    <header className={styles.header}>
      <div><span className={styles.tiny}>把快乐装进口袋</span><h2 id="gacha-title">沫凉扭蛋机</h2></div>
      <span className={styles.counter} data-testid="gacha-remaining">今日 {state ? remaining : '—'} / 3</span>
    </header>
    <div className={`${styles.machineScene} ${phase !== 'idle' ? styles.drawing : ''}`}>
      <div className={styles.machine}>
        <div className={styles.machineSign}>小小惊喜 · 每日三次</div>
        <div className={styles.globe} aria-hidden="true">
          <div className={styles.globeShine} />
          {toyCharacters.slice(0, 6).map((character, index) => <div key={character.id} className={styles.displayCapsule} style={{ left: `${9 + index % 3 * 28}%`, top: `${index < 3 ? 49 : 18}%`, transform: `rotate(${[-15, 12, -10, 14, -8, 18][index]}deg)`, '--capsule-color': character.color } as CSSProperties}><img src={publicPath(`/toys/characters/${character.id}.webp`)} alt="" loading="lazy" draggable={false} /></div>)}
        </div>
        <div className={styles.machineBase}>
          <div className={styles.machineLabel}>MOLIANG</div>
          <button ref={knob} type="button" onClick={draw} disabled={!state || !!error || remaining === 0 || phase !== 'idle'} className={styles.knob} aria-label="转动旋钮，抽一次扭蛋" data-testid="gacha-draw"><span aria-hidden="true" /></button>
          <span className={styles.turnHint}>{phase === 'idle' ? remaining > 0 ? '转一下，遇见新伙伴' : state ? '明天还有小惊喜' : '正在打开收藏…' : '小惊喜正在路上…'}</span>
          <div className={styles.hatch} aria-hidden="true"><div className={`${styles.droppedCapsule} ${phase === 'dropping' || phase === 'opening' ? styles.capsuleVisible : ''} ${phase === 'opening' ? styles.capsuleOpen : ''}`}><i /><b /></div></div>
        </div>
        <div className={styles.machineFeet} aria-hidden="true" />
      </div>
      <span className={styles.sceneStar} aria-hidden="true">✦</span><span className={styles.sceneDot} aria-hidden="true" />
    </div>
    <div className={styles.collectionSummary}>
      <div><span className={styles.tiny}>我的角色图鉴</span><strong>{collected}<span> / {toyCharacters.length} 位伙伴</span></strong></div>
      <button ref={collectionButton} type="button" className={styles.secondary} onClick={() => setDialog('collection')} disabled={!state}>打开图鉴 <span aria-hidden="true">↗</span></button>
    </div>
    <div className={styles.collectionTrack} aria-hidden="true"><span style={{ width: `${collected / toyCharacters.length * 100}%` }} /></div>
    <p className={styles.footnote}>上海时间零点刷新 · 收藏留在这个浏览器</p>
    {state?.lastDraw && phase === 'idle' && <button type="button" className={styles.lastDraw} onClick={() => setDialog(state.lastDraw!.characterId)}>上次收获：{toyCharacters.find(character => character.id === state.lastDraw!.characterId)?.name} <span aria-hidden="true">↗</span></button>}
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={refresh}>重新读取收藏</button></div>}

    {dialog && <ToyDialog title={dialog === 'collection' ? '我的角色图鉴' : '今天的小惊喜'} onClose={closeDialog}>
      {dialog === 'collection' ? <ToyCollection collection={state?.collection || {}} /> : result && <div className={styles.resultCard} data-testid="gacha-result"><span className={styles.resultBadge}>{(state?.collection[result.id] || 0) === 1 ? '新伙伴，初次见面！' : '又见面啦！'}</span><div className={styles.resultArt} style={{ '--result-color': result.color } as CSSProperties}><img src={publicPath(`/toys/characters/${result.id}.webp`)} alt={result.name} /></div><span className={styles.tiny}>{result.series}</span><h4>{result.name}</h4><p>{result.description}</p><div className={styles.saved}>已收入图鉴 · 共收藏 {state?.collection[result.id]} 个</div><button type="button" className={styles.primary} onClick={closeDialog}>好好收藏</button></div>}
    </ToyDialog>}
  </section>;
}
