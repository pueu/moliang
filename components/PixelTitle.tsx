"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { publicPath } from "@/siteConfig";
import { createBreakout, movePaddle, stepBreakout } from './breakoutEngine';
import type { Breakout } from './breakoutEngine';

type Point = { x: number; y: number };
type Geometry = { width: number; height: number; cell: number; left: number; top: number; limitX: number; limitY: number };
type PixelMask = { pixels: Point[]; width: number; height: number };
type Palette = "rainbow" | "candy" | "ocean";

const TITLE = "沫凉ovo";
const FONT_FAMILY = "Moliang ZCOOL KuaiLe";
const PALETTES: Palette[] = ["rainbow", "candy", "ocean"];
const PALETTE_NAMES: Record<Palette, string> = { rainbow: "彩虹", candy: "糖果", ocean: "海洋" };
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const serverReducedMotion = () => false;

// Use the font's real glyph outlines, rasterized at 52px and sampled in 2px
// squares. No manually approximated strokes or character shapes are involved.
function sampleFont(family: string): PixelMask {
  const source = document.createElement("canvas");
  const measure = source.getContext("2d");
  if (!measure) return { pixels: [], width: 1, height: 1 };
  const font = `52px ${family}`;
  measure.font = font;
  const letterSpacing = 5;
  const characters = [...TITLE];
  const advances = characters.map((character) => measure.measureText(character).width);
  source.width = Math.ceil(advances.reduce((sum, width) => sum + width, 0) + letterSpacing * (characters.length - 1) + 20);
  source.height = 80;
  measure.font = font;
  measure.fillStyle = "white";
  measure.textBaseline = "alphabetic";
  let pen = 8;
  characters.forEach((character, index) => {
    measure.fillText(character, pen, 60);
    pen += advances[index] + letterSpacing;
  });
  const raster = measure.getImageData(0, 0, source.width, source.height).data;
  const pixels: Point[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < source.height; y += 2) {
    for (let x = 0; x < source.width - 1; x += 2) {
      let coverage = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) coverage += raster[((y + dy) * source.width + x + dx) * 4 + 3];
      }
      if (coverage < 255) continue;
      const point = { x: x / 2, y: y / 2 };
      pixels.push(point);
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!pixels.length) return { pixels: [], width: 1, height: 1 };
  return {
    pixels: pixels.map(({ x, y }) => ({ x: x - minX, y: y - minY })),
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export default function PixelTitle({ fontUrl = publicPath("/fonts/ZCOOLKuaiLe-Regular.ttf") }: { fontUrl?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionRef = useRef<Point>({ x: 0, y: 0 });
  const geometryRef = useRef<Geometry | null>(null);
  const repaintRef = useRef<(() => void) | null>(null);
  const syncAnimationRef = useRef<(() => void) | null>(null);
  const gameRef = useRef<Breakout | null>(null);
  const controlsRef = useRef<{ start: () => void; toggle: () => void; exit: () => void } | null>(null);
  const keysRef = useRef(new Set<string>());
  const preferencesRef = useRef<{ palette: Palette; paused: boolean }>({ palette: "rainbow", paused: false });
  const dragRef = useRef<{ id: number; x: number; y: number; origin: Point } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [palette, setPalette] = useState<Palette>("rainbow");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [hud, setHud] = useState({ score: 0, lives: 3, paused: false });
  const [result, setResult] = useState('');
  useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);

  function cyclePalette() {
    if (gameRef.current) return;
    const next = PALETTES[(PALETTES.indexOf(preferencesRef.current.palette) + 1) % PALETTES.length];
    preferencesRef.current.palette = next;
    setPalette(next);
    repaintRef.current?.();
  }

  function moveTo(x: number, y: number) {
    if (gameRef.current) return;
    const geometry = geometryRef.current;
    if (!geometry) return;
    positionRef.current = { x: clamp(x, geometry.limitX), y: clamp(y, geometry.limitY) };
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.dataset.offsetX = positionRef.current.x.toFixed(2);
      canvas.dataset.offsetY = positionRef.current.y.toFixed(2);
    }
    repaintRef.current?.();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let frame = 0;
    let phase = 0;
    let lastTime = 0;
    let disposed = false;
    let mask = sampleFont('"Microsoft YaHei", "PingFang SC", sans-serif');
    let savedPosition: Point = { x: 0, y: 0 };
    const fontFace = new FontFace(FONT_FAMILY, `url("${fontUrl}")`, { style: "normal", weight: "400" });
    canvas.dataset.fontStatus = "loading";

    function paint() {
      const geometry = geometryRef.current;
      if (!geometry) return;
      const { width, height, cell, left, top } = geometry;
      const position = positionRef.current;
      context!.clearRect(0, 0, width, height);
      context!.fillStyle = "#101522";
      context!.fillRect(0, 0, width, height);
      const grid = Math.max(6, cell);
      context!.strokeStyle = "rgba(153, 172, 211, 0.075)";
      context!.lineWidth = 0.6;
      context!.beginPath();
      for (let x = 0; x <= width; x += grid) {
        context!.moveTo(x, 0);
        context!.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += grid) {
        context!.moveTo(0, y);
        context!.lineTo(width, y);
      }
      context!.stroke();
      // A soft halo anchors the letters; the actual strokes remain square pixels.
      const halo = context!.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, width * 0.6);
      halo.addColorStop(0, "rgba(115, 99, 205, 0.08)");
      halo.addColorStop(1, "rgba(115, 99, 205, 0)");
      context!.fillStyle = halo;
      context!.fillRect(0, 0, width, height);
      const gap = Math.max(0.45, cell * 0.14);
      const selectedPalette = preferencesRef.current.palette;
      const game = gameRef.current;
      for (const [pixel, point] of mask.pixels.entries()) {
        if (game && !game.bricks[pixel]?.alive) continue;
        const wave = Math.sin(point.x / mask.width * Math.PI * 2 + phase * Math.PI / 180 + point.y * 0.035);
        const hue = selectedPalette === "rainbow"
          ? (point.x / mask.width * 295 + point.y * 2 + phase + 340) % 360
          : selectedPalette === "candy" ? 312 + wave * 42 : 193 + wave * 28;
        const lightness = selectedPalette === "candy" ? 77 : selectedPalette === "ocean" ? 66 : 69;
        const x = left + position.x + point.x * cell;
        const y = top + position.y + point.y * cell;
        context!.fillStyle = `hsl(${hue} 88% ${lightness}%)`;
        context!.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
        context!.fillStyle = "rgba(255,255,255,0.14)";
        context!.fillRect(x + gap / 2, y + gap / 2, cell - gap, Math.max(0.5, cell * 0.12));
      }
      if (game) {
        const { paddle, ball } = game;
        context!.fillStyle = '#b5a5ff';
        context!.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
        context!.beginPath();
        context!.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context!.fillStyle = '#ffffff';
        context!.fill();
        context!.font = '12px system-ui, sans-serif';
        context!.fillStyle = '#c9bfff';
        context!.fillText(`${game.score} 分  ·  ${game.lives} 条生命  ·  剩余 ${game.remaining} 块`, 14, 23);
        if (game.status === 'paused') {
          context!.fillStyle = 'rgba(10, 13, 24, 0.55)';
          context!.fillRect(0, 0, width, height);
          context!.textAlign = 'center';
          context!.font = 'bold 18px system-ui, sans-serif';
          context!.fillStyle = '#ffffff';
          context!.fillText('已暂停 · 点击继续或按空格', width / 2, height / 2);
          context!.textAlign = 'start';
        }
      }
    }

    function finish(message: string) {
      gameRef.current = null;
      keysRef.current.clear();
      positionRef.current = savedPosition;
      setPlaying(false);
      setResult(message);
      canvas!.dataset.gameState = 'idle';
      syncAnimation();
    }

    controlsRef.current = {
      start() {
        const geometry = geometryRef.current;
        if (!geometry || !mask.pixels.length) return;
        savedPosition = { ...positionRef.current };
        positionRef.current = { x: 0, y: 0 };
        dragRef.current = null;
        setDragging(false);
        keysRef.current.clear();
        const gap = Math.max(0.45, geometry.cell * 0.14);
        gameRef.current = createBreakout(mask.pixels.map((point, pixel) => ({
          pixel, x: geometry.left + point.x * geometry.cell + gap / 2,
          y: geometry.top + point.y * geometry.cell + gap / 2,
          width: geometry.cell - gap, height: geometry.cell - gap,
        })), geometry.width, geometry.height);
        setHud({ score: 0, lives: 3, paused: false });
        setResult('');
        setPlaying(true);
        canvas!.dataset.gameState = 'running';
        canvas!.focus({ preventScroll: true });
        syncAnimation();
      },
      toggle() {
        const game = gameRef.current;
        if (!game) return;
        game.status = game.status === 'running' ? 'paused' : 'running';
        keysRef.current.clear();
        setHud({ score: game.score, lives: game.lives, paused: game.status === 'paused' });
        canvas!.dataset.gameState = game.status;
        canvas!.focus({ preventScroll: true });
        syncAnimation();
      },
      exit() { finish('已退出 · 标题恢复拖动'); },
    };

    function tick(time: number) {
      frame = 0;
      const game = gameRef.current;
      if (disposed || document.hidden || (game ? game.status !== 'running' : reducedMotion.matches || preferencesRef.current.paused)) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 50) / 1000 : 0;
      if (game) {
        const direction = Number(keysRef.current.has('ArrowRight') || keysRef.current.has('d')) - Number(keysRef.current.has('ArrowLeft') || keysRef.current.has('a'));
        if (direction) movePaddle(game, game.paddle.x + game.paddle.width / 2 + direction * geometryRef.current!.width * elapsed * 0.85);
        const previousScore = game.score, previousLives = game.lives;
        stepBreakout(game, elapsed);
        if (game.score !== previousScore || game.lives !== previousLives) setHud({ score: game.score, lives: game.lives, paused: false });
        if (game.status === 'won' || game.status === 'over') {
          finish(`${game.status === 'won' ? '全部击碎，通关！' : '游戏结束'} · ${game.score} 分 · 标题恢复拖动`);
          return;
        }
      } else if (lastTime) phase = (phase + elapsed * 7) % 360;
      lastTime = time;
      paint();
      frame = requestAnimationFrame(tick);
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      paint();
      const game = gameRef.current;
      if (!document.hidden && (game ? game.status === 'running' : !reducedMotion.matches && !preferencesRef.current.paused)) frame = requestAnimationFrame(tick);
      canvas!.dataset.animation = frame ? "playing" : "paused";
    }

    function resize() {
      const bounds = canvas!.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cell = Math.max(0.5, Math.min(6, (width - 40) / mask.width, (height - 52) / mask.height));
      const left = (width - mask.width * cell) / 2;
      const top = (height - mask.height * cell) / 2;
      const limitX = Math.max(0, left - 12);
      const limitY = Math.max(0, top - 12);
      const game = gameRef.current;
      if (game) {
        const scaleX = width / game.width, scaleY = height / game.height;
        game.ball.x *= scaleX;
        game.ball.y *= scaleY;
        const paddleCenter = (game.paddle.x + game.paddle.width / 2) * scaleX;
        game.width = width;
        game.height = height;
        game.paddle.width = Math.min(width - 24, Math.max(66, width * 0.16));
        game.paddle.y = height - 22;
        movePaddle(game, paddleCenter);
        const gap = Math.max(0.45, cell * 0.14);
        for (const brick of game.bricks) {
          const point = mask.pixels[brick.pixel];
          brick.x = left + point.x * cell + gap / 2;
          brick.y = top + point.y * cell + gap / 2;
          brick.width = brick.height = cell - gap;
        }
      }
      geometryRef.current = { width, height, cell, left, top, limitX, limitY };
      positionRef.current = { x: clamp(positionRef.current.x, limitX), y: clamp(positionRef.current.y, limitY) };
      canvas!.dataset.offsetX = positionRef.current.x.toFixed(2);
      canvas!.dataset.offsetY = positionRef.current.y.toFixed(2);
      paint();
    }

    repaintRef.current = paint;
    syncAnimationRef.current = syncAnimation;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    syncAnimation();
    void fontFace.load().then((loadedFace) => {
      if (disposed) return;
      document.fonts.add(loadedFace);
      mask = sampleFont(`"${FONT_FAMILY}"`);
      canvas.dataset.fontStatus = "loaded";
      canvas.dataset.fontFamily = "ZCOOL KuaiLe";
      canvas.dataset.pixelCount = String(mask.pixels.length);
      resize();
      setReady(true);
    }).catch(() => {
      if (disposed) return;
      canvas.dataset.fontStatus = "error";
      canvas.dataset.fontFamily = "system fallback";
      setReady(true);
    });
    function suspend() {
      const game = gameRef.current;
      if (game?.status === 'running') {
        game.status = 'paused';
        keysRef.current.clear();
        setHud({ score: game.score, lives: game.lives, paused: true });
        canvas!.dataset.gameState = 'paused';
      }
      syncAnimation();
    }
    function visibility() { if (document.hidden) suspend(); else syncAnimation(); }
    function releaseKey(event: globalThis.KeyboardEvent) { keysRef.current.delete(event.key.toLowerCase().length === 1 ? event.key.toLowerCase() : event.key); }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener('blur', suspend);
    window.addEventListener('keyup', releaseKey);
    reducedMotion.addEventListener("change", syncAnimation);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener('blur', suspend);
      window.removeEventListener('keyup', releaseKey);
      reducedMotion.removeEventListener("change", syncAnimation);
      document.fonts.delete(fontFace);
      repaintRef.current = null;
      syncAnimationRef.current = null;
      controlsRef.current = null;
      gameRef.current = null;
      keysRef.current.clear();
    };
  }, [fontUrl]);

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (gameRef.current) {
      pointerMove(event);
      return;
    }
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { ...positionRef.current } };
    setDragging(true);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (gameRef.current) {
      const bounds = event.currentTarget.getBoundingClientRect();
      movePaddle(gameRef.current, event.clientX - bounds.left);
      repaintRef.current?.();
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    moveTo(drag.origin.x + event.clientX - drag.x, drag.origin.y + event.clientY - drag.y);
  }

  function endDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (gameRef.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyboardMove(event: KeyboardEvent<HTMLCanvasElement>) {
    if (gameRef.current) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'Home', ' ', 'Escape'].includes(key)) event.preventDefault();
      if (key === ' ' && !event.repeat) controlsRef.current?.toggle();
      else if (key === 'Escape') controlsRef.current?.exit();
      else if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(key)) keysRef.current.add(key);
      return;
    }
    const distance = event.shiftKey ? 12 : 4;
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -distance, y: 0 }, ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance }, ArrowDown: { x: 0, y: distance },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      moveTo(positionRef.current.x + direction.x, positionRef.current.y + direction.y);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0, 0);
    }
  }

  return (
    <section aria-label="沫凉ovo 像素标题" className="mb-7 w-full min-w-0 self-stretch">
      <div className="w-full overflow-hidden rounded-3xl border border-white/15 bg-slate-950/80 p-2 shadow-xl shadow-violet-950/10 backdrop-blur-xl">
        <canvas
          ref={canvasRef}
          role={playing ? 'application' : 'img'}
          aria-label={playing ? '沫凉ovo 像素打砖块' : '沫凉ovo'}
          aria-describedby="pixel-title-instructions pixel-title-keyboard"
          tabIndex={0}
          data-testid="pixel-title-canvas"
          data-game-state={playing ? hud.paused ? 'paused' : 'running' : 'idle'}
          data-title-locked={playing ? 'true' : 'false'}
          data-palette={palette}
          data-offset-x="0"
          data-offset-y="0"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={keyboardMove}
          className="block w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-inset"
          style={{ height: playing ? "clamp(280px, 35vw, 360px)" : "clamp(156px, 28vw, 226px)", touchAction: "none", cursor: playing ? 'crosshair' : dragging ? "grabbing" : "grab" }}
        >沫凉ovo</canvas>
        <span id="pixel-title-keyboard" className="sr-only">{playing ? '鼠标、触屏或左右方向键控制挡板。空格暂停或继续，Escape 退出。游戏期间标题不可移动。' : '可用方向键移动，按住 Shift 加快，Home 键复位。'}</span>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-1 pt-2 text-[11px] tracking-wide text-slate-400">
          <span id="pixel-title-instructions" role="status" aria-live="polite">{playing ? `${hud.score} 分 · ${hud.lives} 条生命 · ${hud.paused ? '已暂停' : '移动鼠标 / ← → 控制挡板'} · 标题已锁定` : result || '拖动标题，给灵感换个位置 · ▶ 开始打砖块'}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" disabled={playing} onClick={cyclePalette} className="rounded-md px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300 disabled:opacity-40" aria-label={`切换标题配色，当前${PALETTE_NAMES[palette]}`}><span aria-hidden="true">◈ </span>{PALETTE_NAMES[palette]}</button>
            <button type="button" disabled={!ready} onClick={() => playing ? controlsRef.current?.toggle() : controlsRef.current?.start()} className="rounded-md px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300 disabled:opacity-40" aria-label={!playing ? '开始像素打砖块' : hud.paused ? '继续打砖块' : '暂停打砖块'}>{!playing ? '▶ 开始' : hud.paused ? '▶ 继续' : 'Ⅱ 暂停'}</button>
            <button type="button" onClick={() => playing ? controlsRef.current?.exit() : moveTo(0, 0)} className="rounded-md px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300" aria-label={playing ? '退出打砖块并恢复标题' : '复位像素标题'}>{playing ? '退出 ↩' : '复位 ↺'}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
