"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { publicPath } from "@/siteConfig";

type Point = { x: number; y: number };
type Geometry = { width: number; height: number; cell: number; left: number; top: number; limitX: number; limitY: number };
type PixelMask = { pixels: Point[]; width: number; height: number };

const TITLE = "沫凉ovo";
const FONT_FAMILY = "Moliang ZCOOL KuaiLe";
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

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
    let mask = sampleFont('"Microsoft YaHei", "PingFang SC", sans-serif');
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
      for (const point of mask.pixels) {
        const hue = (point.x / mask.width * 295 + point.y * 2 + phase + 340) % 360;
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
      const cell = Math.max(0.5, Math.min(6, (width - 40) / mask.width, (height - 52) / mask.height));
      const left = (width - mask.width * cell) / 2;
      const top = (height - mask.height * cell) / 2;
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
    void fontFace.load().then((loadedFace) => {
      if (disposed) return;
      document.fonts.add(loadedFace);
      mask = sampleFont(`"${FONT_FAMILY}"`);
      canvas.dataset.fontStatus = "loaded";
      canvas.dataset.fontFamily = "ZCOOL KuaiLe";
      canvas.dataset.pixelCount = String(mask.pixels.length);
      resize();
    }).catch(() => {
      if (disposed) return;
      canvas.dataset.fontStatus = "error";
      canvas.dataset.fontFamily = "system fallback";
    });
    document.addEventListener("visibilitychange", syncAnimation);
    reducedMotion.addEventListener("change", syncAnimation);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      document.fonts.delete(fontFace);
      repaintRef.current = null;
    };
  }, [fontUrl]);

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
          aria-describedby="pixel-title-instructions pixel-title-keyboard"
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
        <span id="pixel-title-keyboard" className="sr-only">可用方向键移动，按住 Shift 加快，Home 键复位。</span>
        <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2 text-[11px] tracking-wide text-slate-400">
          <span id="pixel-title-instructions">拖动标题，给灵感换个位置</span>
          <button type="button" onClick={() => moveTo(0, 0)} className="shrink-0 rounded-md px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300" aria-label="复位像素标题">复位 ↺</button>
        </div>
      </div>
    </section>
  );
}
