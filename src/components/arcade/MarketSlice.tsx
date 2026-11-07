"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newSlice,
  sliceLine,
  stepSlice,
  type SliceFruit,
} from "@/lib/arcade-model";
import {
  ArcadeFrame,
  GameOverlay,
  styles,
  useAutoPause,
  useBest,
  useCanvasSize,
} from "./shared";
const fruitNames = ["mango", "tomato", "watermelon", "coconut"],
  colours = ["#f6b44d", "#ed776b", "#6ebc8b", "#ae7b58"];
export function MarketSlice() {
  const { canvas, box, size } = useCanvasSize(),
    state = useRef(newSlice()),
    trail = useRef<{ x: number; y: number }[]>([]),
    pointer = useRef<number | null>(null),
    dirty = useRef(true),
    [view, setView] = useState(newSlice),
    { best, record } = useBest("market-slice");
  const pause = useCallback(() => {
    pointer.current = null;
    trail.current = [];
    if (state.current.phase === "playing") {
      state.current = { ...state.current, phase: "paused" };
      setView(state.current);
      dirty.current = true;
    }
  }, []);
  useAutoPause(view.phase === "playing", pause);
  function resume() {
    state.current = { ...state.current, phase: "playing" };
    setView(state.current);
    dirty.current = true;
    canvas.current?.focus();
  }
  function restart() {
    state.current = { ...newSlice(Date.now() >>> 0), phase: "playing" };
    trail.current = [];
    pointer.current = null;
    setView(state.current);
    dirty.current = true;
    canvas.current?.focus();
  }
  function cut(from: { x: number; y: number }, to: { x: number; y: number }) {
    const next = sliceLine(state.current, from, to);
    if (next !== state.current) {
      state.current = next;
      setView(next);
      dirty.current = true;
      if (next.phase === "over") record(next.score);
    }
  }
  function sliceFruit(id: number) {
    const fruit = state.current.fruits.find((f) => f.id === id);
    if (fruit) cut(fruit, fruit);
  }
  function point(event: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect(),
      v = size.current;
    return {
      x: (event.clientX - r.left - v.x) / v.scale,
      y: (event.clientY - r.top - v.y) / v.scale,
    };
  }
  useEffect(() => {
    const c = canvas.current,
      context = c?.getContext("2d");
    if (!c || !context) return;
    const ctx: CanvasRenderingContext2D = context;
    let raf = 0,
      last = 0,
      lastHud = 0,
      dimensions = "";
    const frame = (now: number) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (state.current.phase === "playing") {
        const before = state.current;
        state.current = stepSlice(before, dt);
        dirty.current = true;
        if (state.current.phase !== before.phase) {
          setView(state.current);
          record(state.current.score);
        } else if (now - lastHud > 90) {
          setView(state.current);
          lastHud = now;
        }
      }
      const v = size.current,
        key = c.width + ":" + c.height;
      if (key !== dimensions) {
        dirty.current = true;
        dimensions = key;
      }
      if (dirty.current) {
        ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
        ctx.fillStyle = "#123d3b";
        ctx.fillRect(0, 0, v.width, v.height);
        ctx.translate(v.x, v.y);
        ctx.scale(v.scale, v.scale);
        const bg = ctx.createRadialGradient(180, 180, 10, 180, 280, 380);
        bg.addColorStop(0, "#3e7460");
        bg.addColorStop(1, "#123d3b");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 360, 560);
        for (let i = 0; i < 12; i++) {
          ctx.strokeStyle = "#d5bd7d0d";
          ctx.beginPath();
          ctx.moveTo(0, i * 55);
          ctx.lineTo(360, i * 55);
          ctx.stroke();
        }
        ctx.fillStyle = "#8b654b";
        ctx.fillRect(0, 532, 360, 28);
        ctx.fillStyle = "#c79864";
        ctx.fillRect(0, 529, 360, 5);
        function fruit(f: SliceFruit) {
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.x * 0.012 + state.current.seconds * 0.3);
          ctx.shadowColor = "#071b2d55";
          ctx.shadowBlur = 13;
          ctx.shadowOffsetY = 6;
          if (f.coal) {
            ctx.fillStyle = "#313342";
            ctx.beginPath();
            ctx.arc(0, 0, f.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#f59c57";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-12, -9);
            ctx.lineTo(-2, 3);
            ctx.lineTo(10, -7);
            ctx.moveTo(-2, 3);
            ctx.lineTo(-7, 16);
            ctx.stroke();
            ctx.fillStyle = "#ffc075";
            ctx.beginPath();
            ctx.arc(8, 10, 3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const g = ctx.createRadialGradient(-8, -9, 2, 0, 0, f.r);
            g.addColorStop(
              0,
              ["#ffe296", "#ffb19d", "#a4e0a6", "#dab189"][f.type],
            );
            g.addColorStop(1, colours[f.type]);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(
              0,
              0,
              f.type === 0 ? f.r * 0.8 : f.r,
              f.type === 0 ? f.r * 1.15 : f.r,
              0,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.shadowBlur = 0;
            if (f.type === 2) {
              ctx.strokeStyle = "#377e59";
              ctx.lineWidth = 3;
              for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.ellipse(
                  i * 10,
                  0,
                  5,
                  f.r * 0.8,
                  0,
                  -Math.PI / 2,
                  Math.PI / 2,
                );
                ctx.stroke();
              }
            }
            if (f.type === 3) {
              ctx.fillStyle = "#fff0d0";
              ctx.beginPath();
              ctx.arc(0, 0, f.r * 0.68, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#9a684c";
              ctx.beginPath();
              ctx.arc(0, 0, f.r * 0.25, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = "#214b3d";
              ctx.beginPath();
              ctx.ellipse(4, -f.r, 11, 5, -0.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#fff9d844";
              ctx.beginPath();
              ctx.ellipse(-7, -8, 5, 8, -0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
        state.current.fruits.forEach(fruit);
        for (const burst of state.current.burst) {
          ctx.fillStyle = burst.colour < 0 ? "#ffaf6a" : colours[burst.colour];
          ctx.globalAlpha = burst.life / 0.45;
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4,
              r = (0.45 - burst.life) * 140;
            ctx.beginPath();
            ctx.arc(
              burst.x + Math.cos(a) * r,
              burst.y + Math.sin(a) * r,
              3 + burst.life * 5,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        if (trail.current.length > 1) {
          ctx.strokeStyle = "#ffeab1";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          trail.current.forEach((p, i) => {
            if (i) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          });
          ctx.stroke();
        }
        ctx.fillStyle = "#d5dba8";
        ctx.font = "700 9px Arial";
        ctx.textAlign = "center";
        ctx.fillText("FRESH FRUIT. SHARP REFLEXES.", 180, 35);
        if (state.current.combo > 1) {
          ctx.font = "700 23px Georgia";
          ctx.fillStyle = "#ffe3a3";
          ctx.fillText("COMBO ×" + state.current.combo, 180, 76);
        }
        dirty.current = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvas, size, record]);
  return (
    <ArcadeFrame
      id="market-slice"
      title="Market Slice"
      tag="A FRESH LITTLE REFLEX CHALLENGE"
      score={view.score}
      best={best}
      playing={view.phase === "playing"}
      paused={view.phase === "paused"}
      pause={pause}
      resume={resume}
      stat={`${Math.max(0, Math.ceil(60 - view.seconds))}s left · ${view.hearts} hearts · Swipe fruit, avoid hot coals`}
    >
      <div ref={box} className={styles.canvasBox}>
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label="Market fruit-slicing game. Swipe or tap fruit. Keyboard users can Tab to the live Slice fruit buttons below."
          onPointerDown={(event) => {
            if (state.current.phase !== "playing" || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = event.pointerId;
            const p = point(event);
            trail.current = [p];
            cut(p, p);
            canvas.current?.focus();
          }}
          onPointerMove={(event) => {
            if (pointer.current !== event.pointerId) return;
            const p = point(event),
              last = trail.current.at(-1) || p;
            cut(last, p);
            trail.current = [...trail.current.slice(-11), p];
            dirty.current = true;
          }}
          onPointerUp={() => {
            pointer.current = null;
            trail.current = [];
            dirty.current = true;
          }}
          onPointerCancel={() => {
            pointer.current = null;
            trail.current = [];
            dirty.current = true;
          }}
        />
        <div
          className={styles.sliceAccess}
          aria-label="Keyboard and tap fruit targets"
        >
          {view.phase === "playing" &&
            view.fruits
              .filter((f) => !f.coal && f.y > 35 && f.y < 520)
              .slice(0, 4)
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => sliceFruit(f.id)}
                >
                  Slice {fruitNames[f.type]} #{f.id}
                </button>
              ))}
        </div>
      </div>
      {view.phase === "ready" && (
        <GameOverlay
          title="Fresh from the market."
          detail="Swipe or tap flying fruit. Slice quickly for combos, avoid glowing hot coals, and keep three hearts for a 60-second round. Missing fruit costs a heart too. Keyboard players can use the live fruit buttons."
          action={resume}
          label="Start slicing"
        />
      )}
      {view.phase === "paused" && (
        <GameOverlay
          title="Keep your fruit fresh."
          detail="The fruit and timer are paused. Your round is waiting."
          action={resume}
          label="Keep slicing"
        />
      )}
      {view.phase === "over" && (
        <GameOverlay
          title={view.hearts ? "A fresh finish." : "Time for a fresh batch."}
          detail={`${view.score} points in ${Math.floor(view.seconds)} seconds. Keep your swipe clear of the hot coals and try for a longer combo.`}
          action={restart}
          label="Another fresh batch"
        />
      )}
    </ArcadeFrame>
  );
}
