"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

type Point = { x: number; y: number };
type Geometry = { width: number; height: number; cell: number; left: number; top: number; limitX: number; limitY: number };

// Each stroke is drawn on a tiny, deliberate pixel matrix. The Chinese glyphs
// stay readable even on systems without a Chinese font installed.
function makeGlyph(width: number, strokes: number[][]): Point[] {
  const occupied = new Set<string>();
  for (const [x, y, w, h] of strokes) {
    for (let row = y; row < y + h; row++) {
      for (let column = x; column < x + w; column++) {
        if (column >= 0 && column < width && row >= 0 && row < 23) occupied.add(`${column},${row}`);
      }
    }
  }
  return Array.from(occupied, (pixel) => {
    const [x, y] = pixel.split(",").map(Number);
    return { x, y };
  });
}

const GLYPHS = [
  { width: 21, strokes: [[1, 3, 2, 2], [3, 5, 2, 2], [0, 9, 2, 2], [2, 11, 2, 2], [3, 15, 2, 3], [2, 17, 2, 3], [1, 19, 2, 3], [13, 1, 2, 22], [7, 5, 14, 2], [6, 10, 15, 2], [11, 13, 2, 3], [9, 15, 2, 3], [7, 17, 2, 3], [5, 19, 2, 2], [15, 13, 2, 3], [17, 15, 2, 3], [19, 17, 2, 3]] },
  { width: 21, strokes: [[1, 4, 2, 2], [3, 6, 2, 2], [3, 14, 2, 3], [2, 17, 2, 3], [1, 20, 2, 2], [13, 1, 2, 3], [6, 5, 15, 2], [8, 9, 11, 2], [8, 11, 2, 3], [17, 11, 2, 3], [8, 14, 11, 2], [13, 16, 2, 7], [10, 21, 3, 2], [9, 17, 2, 3], [7, 19, 2, 2], [16, 17, 2, 3], [18, 19, 2, 2]] },
  { width: 11, strokes: [[2, 10, 7, 2], [0, 12, 2, 8], [9, 12, 2, 8], [2, 20, 7, 2]] },
  { width: 11, strokes: [[0, 10, 2, 5], [9, 10, 2, 5], [2, 15, 2, 4], [7, 15, 2, 4], [4, 19, 3, 3]] },
  { width: 11, strokes: [[2, 10, 7, 2], [0, 12, 2, 8], [9, 12, 2, 8], [2, 20, 7, 2]] },
];
const PIXELS: Point[] = [];
let wordWidth = 0;
GLYPHS.forEach((glyph, index) => {
  PIXELS.push(...makeGlyph(glyph.width, glyph.strokes).map((point) => ({ x: point.x + wordWidth, y: point.y })));
  wordWidth += glyph.width + (index === GLYPHS.length - 1 ? 0 : 4);
});
const WORD_WIDTH = wordWidth;
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

export default function PixelTitle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionRef = useRef<Point>({ x: 0, y: 0 });
  const geometryRef = useRef<Geometry | null>(null);
  const repaintRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; origin: Point } | null>(null);
  const [dragging, setDragging] = useState(false);

  function moveTo(x: number, y: number) {
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let phase = 0;
    let lastTime = 0;
    let disposed = false;

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
      for (const point of PIXELS) {
        const hue = (point.x / WORD_WIDTH * 295 + point.y * 2 + phase + 340) % 360;
        const x = left + position.x + point.x * cell;
        const y = top + position.y + point.y * cell;
        context!.fillStyle = `hsl(${hue} 88% 69%)`;
        context!.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
        context!.fillStyle = "rgba(255,255,255,0.14)";
        context!.fillRect(x + gap / 2, y + gap / 2, cell - gap, Math.max(0.5, cell * 0.12));
      }
    }

    function tick(time: number) {
      frame = 0;
      if (disposed || document.hidden || reducedMotion.matches) return;
      if (lastTime) phase = (phase + Math.min(time - lastTime, 100) * 0.007) % 360;
      lastTime = time;
      paint();
      frame = requestAnimationFrame(tick);
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      paint();
      if (!document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    }

    function resize() {
      const bounds = canvas!.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cell = Math.max(1, Math.min(6, (width - 40) / WORD_WIDTH, (height - 52) / 23));
      const left = (width - WORD_WIDTH * cell) / 2;
      const top = (height - 23 * cell) / 2;
      const limitX = Math.max(0, left - 12);
      const limitY = Math.max(0, top - 12);
      geometryRef.current = { width, height, cell, left, top, limitX, limitY };
      positionRef.current = { x: clamp(positionRef.current.x, limitX), y: clamp(positionRef.current.y, limitY) };
      canvas!.dataset.offsetX = positionRef.current.x.toFixed(2);
      canvas!.dataset.offsetY = positionRef.current.y.toFixed(2);
      paint();
    }

    repaintRef.current = paint;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    syncAnimation();
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", syncAnimation);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      repaintRef.current = null;
    };
  }, []);

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { ...positionRef.current } };
    setDragging(true);
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    moveTo(drag.origin.x + event.clientX - drag.x, drag.origin.y + event.clientY - drag.y);
  }

  function endDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyboardMove(event: KeyboardEvent<HTMLCanvasElement>) {
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
    <section aria-label="沫凉ovo 像素标题" className="mx-auto mb-7 w-full max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-white/15 bg-slate-950/80 p-2 shadow-xl shadow-violet-950/10 backdrop-blur-xl">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="沫凉ovo"
          aria-description="彩虹像素标题。可拖动，或用方向键移动，Home 键复位。"
          aria-describedby="pixel-title-instructions"
          tabIndex={0}
          data-testid="pixel-title-canvas"
          data-offset-x="0"
          data-offset-y="0"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={keyboardMove}
          className="block w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-inset"
          style={{ height: "clamp(156px, 28vw, 226px)", touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
        >沫凉ovo</canvas>
        <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2 text-[11px] tracking-wide text-slate-400">
          <span id="pixel-title-instructions">拖动标题，给灵感换个位置</span>
          <button type="button" onClick={() => moveTo(0, 0)} className="shrink-0 rounded-md px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300" aria-label="复位像素标题">复位 ↺</button>
        </div>
      </div>
    </section>
  );
}
