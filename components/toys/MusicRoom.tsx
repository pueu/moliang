'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, ExternalLink } from 'lucide-react';
import { publicPath } from '../../siteConfig';
import { roomRecords } from '../../data/roomRecords';
import { loadSpotifyEmbed, type EmbedController, type PlaybackEvent } from './spotifyEmbed';
import styles from './toys.module.css';

type Status = 'off' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'error';
export default function MusicRoom() {
  const [index, setIndex] = useState(0);
  const [night, setNight] = useState(false);
  const [status, setStatus] = useState<Status>('off');
  const [enabled, setEnabled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<EmbedController | null>(null);
  const slot = useRef<HTMLDivElement>(null);
  const currentIndex = useRef(0);
  const loadedIndex = useRef(0);
  const wantsPlay = useRef(false);
  const record = roomRecords[index];
  const uri = (i: number) => `spotify:track:${roomRecords[i].spotifyId}`;
  const playing = status === 'playing';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number;
    let heartbeat: number;
    let owned: EmbedController | null = null;
    setStatus('loading');
    const fail = () => { if (!cancelled) setStatus('error'); };
    timer = window.setTimeout(fail, 20000);
    loadSpotifyEmbed().then(api => {
      if (cancelled || !slot.current) return;
      // The API replaces its target. Keeping a wrapper makes retry/unmount safe.
      const target = document.createElement('div');
      slot.current.replaceChildren(target);
      const requestedIndex = currentIndex.current;
      loadedIndex.current = requestedIndex;
      api.createController(target, { uri: uri(requestedIndex), width: '100%', height: 152 }, embed => {
        if (cancelled) { embed.destroy(); return; }
        owned = embed;
        controller.current = embed;
        embed.addListener('ready', () => {
          if (cancelled) return;
          clearTimeout(timer);
          if (loadedIndex.current !== currentIndex.current) {
            loadedIndex.current = currentIndex.current;
            (embed.loadEntity || embed.loadUri).call(embed, uri(currentIndex.current));
            return;
          }
          setStatus('ready');
          if (wantsPlay.current) { wantsPlay.current = false; try { embed.togglePlay(); } catch { fail(); } }
        });
        embed.addListener('playback_update', (event: PlaybackEvent) => {
          if (cancelled || (event.data.playingURI && event.data.playingURI !== uri(currentIndex.current))) return;
          clearTimeout(timer);
          clearTimeout(heartbeat);
          setStatus(event.data.isBuffering ? 'buffering' : event.data.isPaused ? 'paused' : 'playing');
          if (!event.data.isPaused && !event.data.isBuffering) heartbeat = window.setTimeout(() => { if (!cancelled) setStatus('buffering'); }, 6000);
        });
        embed.addListener('error', fail);
      });
    }).catch(fail);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(heartbeat); owned?.destroy(); controller.current = null; slot.current?.replaceChildren(); };
  }, [enabled, attempt]);

  useEffect(() => {
    if (status !== 'buffering') return;
    const timer = window.setTimeout(() => setStatus('error'), 20000);
    return () => clearTimeout(timer);
  }, [status]);

  function select(next: number, autoplay = false) {
    const nextIndex = (next + roomRecords.length) % roomRecords.length;
    const changed = currentIndex.current !== nextIndex;
    currentIndex.current = nextIndex;
    setIndex(nextIndex);
    wantsPlay.current = autoplay;
    if (!enabled) { setEnabled(true); return; }
    const embed = controller.current;
    if (status === 'error' || !embed) { if (status === 'error') setAttempt(value => value + 1); return; }
    if (changed) {
      setStatus('buffering');
      loadedIndex.current = nextIndex;
      try { (embed.loadEntity || embed.loadUri).call(embed, uri(nextIndex)); }
      catch { setStatus('error'); }
    }
  }
  function toggle() {
    if (!enabled || status === 'error') { wantsPlay.current = true; if (!enabled) setEnabled(true); else setAttempt(value => value + 1); return; }
    // togglePlay also controls Spotify's anonymous preview player. The SDK's
    // pause command only reaches its full-track player in some environments.
    try { controller.current?.togglePlay(); }
    catch { setStatus('error'); }
  }
  const statusText = { off: '挑一张唱片，让房间慢下来', loading: '正在连接 Spotify…', ready: '点击下方播放器开始聆听', playing: '正在播放 · 留一点时间给自己', paused: '唱片暂停中', buffering: '正在缓冲…', error: 'Spotify 暂时未连接，可重试或前往平台' }[status];

  return <section className={`${styles.panel} ${styles.musicPanel}`} aria-labelledby="music-room-title" data-testid="music-room">
    <header className={styles.header}><div><span className={styles.tiny}>给耳朵放个小假</span><h2 id="music-room-title">音乐小房间</h2></div><div className={styles.lightSwitch} role="group" aria-label="房间灯光"><button type="button" aria-pressed={!night} onClick={() => setNight(false)}>午后</button><button type="button" aria-pressed={night} onClick={() => setNight(true)}>夜晚</button></div></header>
    <div className={`${styles.room} ${night ? styles.roomNight : ''} ${playing ? styles.roomPlaying : ''}`} data-testid="music-scene" data-playing={playing} data-light={night ? 'night' : 'afternoon'}>
      <div className={styles.window} aria-hidden="true"><span>{night ? '☾' : '☀'}</span></div>
      <div className={styles.roomCaption} aria-hidden="true">moliang’s listening room<br /><span>R&B · just a little slower</span></div>
      <div className={styles.lamp} aria-hidden="true"><i /><b /></div>
      <div className={styles.ornament} aria-hidden="true">✦</div>
      <div className={styles.turntable} aria-hidden="true"><div className={styles.vinyl}><div className={styles.vinylLabel}><img src={publicPath(`/toys/records/${record.id}.jpg`)} alt="" /></div></div><div className={styles.tonearm} /><span className={styles.deckLight} /><span className={styles.deckBrand}>MOLIANG · 33⅓</span></div>
    </div>
    <div className={styles.nowPlaying}><div><strong>{record.title}</strong><span>{record.artist}</span></div><div className={styles.transport}><button type="button" aria-label="上一首" onClick={() => select(currentIndex.current - 1, playing)}><ChevronLeft size={19} /></button><button type="button" className={styles.playButton} aria-label={playing ? '暂停音乐' : '播放音乐'} onClick={toggle} disabled={status === 'loading'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><button type="button" aria-label="下一首" onClick={() => select(currentIndex.current + 1, playing)}><ChevronRight size={19} /></button></div></div>
    <p className={styles.playerStatus} role="status">{statusText}</p>
    <div className={styles.recordShelf} role="group" aria-label="选择唱片">{roomRecords.map((item, i) => <button key={item.id} type="button" className={styles.recordCover} aria-label={`${item.title} — ${item.artist}`} aria-pressed={index === i} onClick={() => select(i, playing)}><img src={publicPath(`/toys/records/${item.id}.jpg`)} alt="" loading="lazy" /><span>{item.title}</span></button>)}</div>
    {enabled && <div className={styles.embedArea}><div ref={slot} className={styles.embedSlot} data-testid="spotify-embed" />{status === 'error' && <button type="button" className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>重新连接 Spotify</button>}</div>}
    <div className={styles.musicFootnote}><span>Spotify 官方播放 · 部分环境仅提供试听</span><a href={`https://open.spotify.com/track/${record.spotifyId}`} target="_blank" rel="noopener noreferrer">平台完整版 <ExternalLink size={12} aria-hidden="true" /></a></div>
  </section>;
}
