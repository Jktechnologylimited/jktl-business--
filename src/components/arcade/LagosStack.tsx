"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { dropStack, newStack, stepStack } from "@/lib/arcade-model";
import {
  ArcadeFrame,
  GameOverlay,
  styles,
  useAutoPause,
  useBest,
  useCanvasSize,
} from "./shared";
const colours = [
  "#edc879",
  "#77bdb1",
  "#df928c",
  "#9baee0",
  "#9bc77f",
  "#d5a1c7",
];
export function LagosStack() {
  const { canvas, box, size } = useCanvasSize(),
    state = useRef(newStack()),
    dirty = useRef(true),
    [view, setView] = useState(newStack),
    { best, record } = useBest("lagos-stack");
  const pause = useCallback(() => {
    if (state.current.phase === "playing") {
      state.current = { ...state.current, phase: "paused" };
      setView(state.current);
      dirty.current = true;
    }
  }, []);
  useAutoPause(view.phase === "playing", pause);
  const resume = () => {
    state.current = { ...state.current, phase: "playing" };
    setView(state.current);
    dirty.current = true;
    canvas.current?.focus();
  };
  const restart = () => {
    state.current = { ...newStack(), phase: "playing" };
    setView(state.current);
    dirty.current = true;
    canvas.current?.focus();
  };
  const drop = () => {
    const next = dropStack(state.current);
    if (next === state.current) return;
    state.current = next;
    dirty.current = true;
    setView(next);
    if (next.phase === "over" || next.phase === "won") record(next.score);
    canvas.current?.focus();
  };
  useEffect(() => {
    const c = canvas.current,
      context = c?.getContext("2d");
    if (!c || !context) return;
    const ctx: CanvasRenderingContext2D = context;
    let raf = 0,
      last = 0,
      camera = 0,
      dimensions = "";
    const frame = (now: number) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      if (state.current.phase === "playing") {
        state.current = stepStack(state.current, dt);
        dirty.current = true;
      }
      const v = size.current,
        key = c.width + ":" + c.height;
      if (key !== dimensions) {
        dirty.current = true;
        dimensions = key;
      }
      const s = state.current,
        target = Math.max(0, (s.floors.length - 8) * 28);
      camera += (target - camera) * 0.15;
      if (Math.abs(target - camera) > 0.1) dirty.current = true;
      if (dirty.current) {
        ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
        ctx.fillStyle = "#122b42";
        ctx.fillRect(0, 0, v.width, v.height);
        ctx.translate(v.x, v.y);
        ctx.scale(v.scale, v.scale);
        const sky = ctx.createLinearGradient(0, 0, 0, 560);
        sky.addColorStop(0, "#24475d");
        sky.addColorStop(1, "#adbfad");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 360, 560);
        ctx.fillStyle = "#f3db97";
        ctx.beginPath();
        ctx.arc(280, 92, 32, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const x = i * 57 - 25,
            h = 80 + ((i * 37) % 130);
          ctx.fillStyle = i % 2 ? "#4d7f83" : "#679790";
          ctx.fillRect(x, 455 - h, 44, h + 100);
          for (let j = 0; j < Math.floor(h / 20); j++)
            for (let k = 0; k < 2; k++) {
              ctx.fillStyle = "#c3d6b7";
              ctx.fillRect(x + 8 + k * 19, 465 - h + j * 20, 8, 8);
            }
        }
        ctx.fillStyle = "#2c6874";
        ctx.fillRect(0, 455, 360, 105);
        ctx.strokeStyle = "#9cc8bd88";
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 53, 480 + (i % 3) * 18);
          ctx.lineTo(i * 53 + 27, 480 + (i % 3) * 18);
          ctx.stroke();
        }
        function floor(x: number, y: number, w: number, colour: string) {
          ctx.fillStyle = colour;
          ctx.fillRect(x, y, w, 28);
          ctx.fillStyle = "#ffffff33";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 8, y - 7);
          ctx.lineTo(x + w + 8, y - 7);
          ctx.lineTo(x + w, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#0b1d3a44";
          ctx.beginPath();
          ctx.moveTo(x + w, y);
          ctx.lineTo(x + w + 8, y - 7);
          ctx.lineTo(x + w + 8, y + 21);
          ctx.lineTo(x + w, y + 28);
          ctx.fill();
          ctx.fillStyle = "#fff3cb88";
          for (let i = 8; i < w - 8; i += 22) ctx.fillRect(x + i, y + 8, 9, 9);
        }
        s.floors.forEach((f, i) =>
          floor(f.x, 510 - i * 28 + camera, f.w, colours[i % colours.length]),
        );
        if (s.phase !== "over" && s.phase !== "won") {
          const top = s.floors.at(-1)!;
          ctx.save();
          ctx.strokeStyle = "#fff1ba55";
          ctx.setLineDash([4, 5]);
          ctx.strokeRect(top.x, 510 - s.floors.length * 28 + camera, top.w, 28);
          ctx.restore();
          floor(
            s.x,
            510 - s.floors.length * 28 + camera,
            top.w,
            colours[s.floors.length % colours.length],
          );
        }
        ctx.fillStyle = "#f9edcf";
        ctx.textAlign = "center";
        ctx.font = "700 10px Arial";
        ctx.fillText("LAGOS, ONE FLOOR AT A TIME", 180, 34);
        ctx.font = "600 28px Georgia";
        ctx.fillText(
          String(s.floors.length - 1).padStart(2, "0") + " / 20",
          180,
          70,
        );
        if (s.perfect) {
          ctx.font = "700 13px Arial";
          ctx.fillStyle = "#ffe6a1";
          ctx.fillText("PERFECT · STREAK " + s.streak, 180, 111);
        }
        dirty.current = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvas, size]);
  return (
    <ArcadeFrame
      id="lagos-stack"
      title="Lagos Stack"
      tag="TIMING IS EVERYTHING"
      score={view.score}
      best={best}
      playing={view.phase === "playing"}
      paused={view.phase === "paused"}
      pause={pause}
      resume={resume}
      stat={`${view.floors.length - 1}/20 floors · Perfect streak ${view.streak}`}
      controls={
        <button
          type="button"
          className={styles.primary + " " + styles.stackDrop}
          disabled={view.phase !== "playing"}
          onClick={drop}
        >
          Drop floor · Space
        </button>
      }
    >
      <div ref={box} className={styles.canvasBox}>
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label="Moving tower floor. Press Space or tap Drop floor to align it with the tower below."
          onPointerDown={(event) => {
            event.preventDefault();
            drop();
          }}
          onKeyDown={(event) => {
            if (["Space", "Enter"].includes(event.code)) {
              event.preventDefault();
              if (!event.repeat) drop();
            }
          }}
        />
      </div>
      {view.phase === "ready" && (
        <GameOverlay
          title="Raise a little skyline."
          detail="Tap or press Space to drop each moving floor. Line it up with the tower: overhanging edges are cut away. Reach 20 floors to finish your skyline."
          action={resume}
          label="Build the skyline"
        />
      )}
      {view.phase === "paused" && (
        <GameOverlay
          title="The city can wait."
          detail="Your moving floor is paused. Take a breath and line up your next landing."
          action={resume}
          label="Keep building"
        />
      )}
      {view.phase === "over" && (
        <GameOverlay
          title="A little too far."
          detail={`${view.floors.length - 1} floors and ${view.score} points. Perfect landings keep your tower wide and build a bonus streak.`}
          action={restart}
          label="Build again"
        />
      )}
      {view.phase === "won" && (
        <GameOverlay
          title="Your skyline is glowing."
          detail={`Twenty floors. ${view.score} points. Come back for a taller perfect streak.`}
          action={restart}
          label="Another skyline"
        />
      )}
    </ArcadeFrame>
  );
}
