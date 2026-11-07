"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Expand,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GameSwitcher } from "@/components/games/GameSwitcher";
import {
  createSky,
  SKY_ZONES,
  skyMap,
  stepSky,
  type SkyState,
} from "@/lib/skybound";
import { drawSky } from "./draw-world";
import { SkyAudio } from "./sky-audio";
import styles from "./Skybound.module.css";
const BEST_KEY = "jktl-kora-skybound-best-v1";
export function SkyboundGame() {
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    root = useRef<HTMLElement>(null),
    state = useRef(createSky()),
    map = useRef(skyMap(0)),
    keys = useRef(new Set<string>()),
    jump = useRef(false),
    dirty = useRef(true),
    audio = useRef<SkyAudio | null>(null);
  const [view, setView] = useState<SkyState>(createSky),
    [best, setBest] = useState(0),
    [sound, setSound] = useState(true),
    [notice, setNotice] = useState("");
  const clearKeys = useCallback(() => {
    keys.current.clear();
    jump.current = false;
  }, []);
  const pause = useCallback(() => {
    clearKeys();
    if (state.current.phase === "playing") {
      state.current = { ...state.current, phase: "paused" };
      setView(state.current);
      dirty.current = true;
    }
  }, [clearKeys]);
  const resume = () => {
    clearKeys();
    audio.current?.unlock();
    state.current = { ...state.current, phase: "playing" };
    setView(state.current);
    dirty.current = true;
    canvas.current?.focus();
  };
  const fresh = (next = false) => {
    clearKeys();
    const old = state.current;
    state.current = createSky(
      next ? old.level + 1 : 0,
      next ? old.score : 0,
      next ? Math.min(3, old.health + 1) : 3,
    );
    state.current.phase = "playing";
    map.current = skyMap(state.current.level);
    setView(state.current);
    dirty.current = true;
    audio.current?.unlock();
    canvas.current?.focus();
  };
  useEffect(() => {
    audio.current = new SkyAudio();
    try {
      const stored = Number(localStorage.getItem(BEST_KEY));
      if (Number.isSafeInteger(stored) && stored >= 0 && stored < 1000000) {
        const timer = setTimeout(() => setBest(stored), 0);
        return () => {
          clearTimeout(timer);
          audio.current?.dispose();
        };
      }
    } catch {}
    return () => audio.current?.dispose();
  }, []);
  useEffect(() => {
    const c = canvas.current,
      container = stage.current;
    if (!c || !container) return;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) {
      const timer = setTimeout(
        () =>
          setNotice(
            "Your browser could not start the game canvas. Try another browser.",
          ),
        0,
      );
      return () => clearTimeout(timer);
    }
    let width = 960,
      scale = 1,
      dpr = 1,
      offsetX = 0,
      offsetY = 0,
      raf = 0,
      last = 0,
      accumulator = 0,
      lastHud = 0;
    const resize = () => {
      const bounds = container.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(bounds.width * dpr);
      c.height = Math.round(bounds.height * dpr);
      width = Math.max(300, (bounds.width / bounds.height) * 540);
      scale = Math.min(bounds.width / width, bounds.height / 540);
      offsetX = (bounds.width - width * scale) / 2;
      offsetY = (bounds.height - 540 * scale) / 2;
      dirty.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (state.current.phase === "playing") {
        accumulator += dt;
        while (accumulator >= 1 / 120 && state.current.phase === "playing") {
          const before = state.current;
          state.current = stepSky(
            before,
            {
              left: keys.current.has("left"),
              right: keys.current.has("right"),
              jump: jump.current,
              held: keys.current.has("jump"),
            },
            1 / 120,
            map.current,
          );
          jump.current = false;
          accumulator -= 1 / 120;
          for (const event of state.current.events) audio.current?.play(event);
          if (state.current.phase !== before.phase) {
            clearKeys();
            setView(state.current);
            if (
              state.current.phase === "won" ||
              state.current.phase === "over"
            ) {
              try {
                const previous = Number(localStorage.getItem(BEST_KEY)),
                  best = Math.max(
                    state.current.score,
                    Number.isSafeInteger(previous) &&
                      previous >= 0 &&
                      previous < 1000000
                      ? previous
                      : 0,
                  );
                localStorage.setItem(BEST_KEY, String(best));
                setBest(best);
              } catch {
                setBest((old) => Math.max(old, state.current.score));
              }
            }
          }
        }
        if (now - lastHud > 100) {
          setView(state.current);
          lastHud = now;
        }
        dirty.current = true;
      } else accumulator = 0;
      if (dirty.current) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#102637";
        ctx.fillRect(0, 0, c.width / dpr, c.height / dpr);
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.imageSmoothingEnabled = false;
        drawSky(ctx, state.current, map.current, width, state.current.seconds);
        dirty.current = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const down = (event: KeyboardEvent) => {
      if (
        !root.current?.contains(document.activeElement) ||
        (event.target instanceof HTMLElement &&
          event.target.closest("button,input,select,a,summary"))
      )
        return;
      const binding: Record<string, string> = {
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
        Space: "jump",
        ArrowUp: "jump",
        KeyW: "jump",
      };
      const key = binding[event.code];
      if (key) {
        event.preventDefault();
        if (key === "jump" && !keys.current.has(key)) jump.current = true;
        keys.current.add(key);
      }
      if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        pause();
      }
    };
    const up = (event: KeyboardEvent) => {
      const binding: Record<string, string> = {
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
        Space: "jump",
        ArrowUp: "jump",
        KeyW: "jump",
      };
      if (binding[event.code]) {
        event.preventDefault();
        keys.current.delete(binding[event.code]);
      }
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      clearKeys();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [pause, clearKeys]);
  const world = useMemo(() => skyMap(view.level), [view.level]);
  const level = SKY_ZONES[view.level],
    progress = Math.min(100, Math.round((view.x / world.width) * 100));
  const control = (key: string, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        if (state.current.phase !== "playing") return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        if (key === "jump" && !keys.current.has(key)) jump.current = true;
        keys.current.add(key);
        canvas.current?.focus();
      }}
      onPointerUp={() => keys.current.delete(key)}
      onPointerCancel={() => keys.current.delete(key)}
      onLostPointerCapture={() => keys.current.delete(key)}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.code === "Space" || event.code === "Enter") {
          event.preventDefault();
          if (key === "jump" && !keys.current.has(key)) jump.current = true;
          keys.current.add(key);
        }
      }}
      onKeyUp={() => keys.current.delete(key)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <main className={styles.game} ref={root}>
      <header className={styles.header}>
        <a href="https://games.jktl.com.ng" target="_top">
          <Image src="/jktl-logo.png" alt="" width={28} height={28} />
          <b>JKTL</b>
          <span>KORA SKYBOUND</span>
        </a>
        <div>
          <button
            type="button"
            onClick={() => {
              const value = !sound;
              setSound(value);
              if (audio.current) {
                audio.current.enabled = value;
                if (value) audio.current.unlock();
              }
            }}
            aria-label={sound ? "Mute sound" : "Enable sound"}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            type="button"
            aria-label="Full screen"
            onClick={() => {
              const task = document.fullscreenElement
                ? document.exitFullscreen()
                : root.current?.requestFullscreen?.();
              task?.catch(() =>
                setNotice(
                  "Full screen is not available here. Open the game directly for more room.",
                ),
              );
            }}
          >
            <Expand size={17} />
          </button>
          <GameSwitcher current="skybound" onOpen={pause} />
        </div>
      </header>
      <section className={styles.hud} aria-label="Adventure progress">
        <div>
          <small>WORLD {view.level + 1} / 3</small>
          <b>{level.name}</b>
        </div>
        <div>
          <small>POINTS</small>
          <b data-sky-score>{view.score}</b>
        </div>
        <div
          className={styles.hearts}
          aria-label={`${view.health} hearts remaining`}
        >
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              size={16}
              fill={i < view.health ? "currentColor" : "none"}
              style={{ opacity: i < view.health ? 1 : 0.3 }}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={
            view.phase === "paused" ? "Resume adventure" : "Pause adventure"
          }
          disabled={view.phase !== "playing" && view.phase !== "paused"}
          onClick={view.phase === "paused" ? resume : pause}
        >
          {view.phase === "paused" ? <Play size={17} /> : <Pause size={17} />}
        </button>
      </section>
      <div
        className={styles.progress}
        aria-label={`${progress}% of level explored`}
      >
        <span style={{ width: progress + "%" }} />
      </div>
      <div className={styles.stage} ref={stage}>
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label="Kora Skybound platform adventure. Arrow keys or A and D to move. Space or W to jump. P pauses."
          aria-describedby="sky-instructions"
        />
        {view.phase !== "playing" && (
          <section
            className={styles.overlay}
            aria-label={
              view.phase === "ready" ? "Start adventure" : "Adventure menu"
            }
          >
            <p className={styles.eyebrow}>
              {view.phase === "ready"
                ? "AN ORIGINAL JKTL PIXEL ADVENTURE"
                : view.phase === "clear"
                  ? "BEACON RESTORED"
                  : view.phase === "won"
                    ? "YOU BROUGHT THE LIGHT HOME"
                    : "TAKE A BREATHER"}
            </p>
            <h1>
              {view.phase === "ready" ? (
                <>
                  Kora
                  <br />
                  <em>Skybound.</em>
                </>
              ) : view.phase === "paused" ? (
                "The sky can wait."
              ) : view.phase === "clear" ? (
                "Onward, Kora."
              ) : view.phase === "won" ? (
                "A brighter world."
              ) : (
                "One more adventure?"
              )}
            </h1>
            <p>
              {view.phase === "ready"
                ? "Leap across rooftops, gather sunstones and restore three beacons. Your little adventure starts by the lagoon."
                : view.phase === "paused"
                  ? "Your progress is right here. Come back when you’re ready."
                  : view.phase === "clear"
                    ? "A new neighbourhood is waiting. One heart restored for the journey."
                    : view.phase === "won"
                      ? "Coast, market, skyline. All three beacons are glowing again."
                      : "Every great leap takes practice. Start a new journey from the coast."}
            </p>
            {view.phase !== "ready" && (
              <div className={styles.result}>
                {view.score} points <span>Device best: {best}</span>
              </div>
            )}
            <button
              type="button"
              className={styles.primary}
              onClick={
                view.phase === "ready" || view.phase === "paused"
                  ? resume
                  : () => fresh(view.phase === "clear")
              }
            >
              {view.phase === "ready"
                ? "Let’s adventure"
                : view.phase === "paused"
                  ? "Keep going"
                  : view.phase === "clear"
                    ? "Next neighbourhood"
                    : "Play again"}
              <ArrowRight size={17} />
            </button>
            <p className={styles.hint}>
              {view.phase === "ready"
                ? "Move: ← → / A D · Jump: Space / W · Hold for a higher jump"
                : "Collect sunstones. Jump on creatures. Watch the gaps."}
            </p>
          </section>
        )}
      </div>
      <section className={styles.controls} aria-label="Touch controls">
        <div>
          {control("left", "Move left", <ArrowLeft size={22} />)}
          {control("right", "Move right", <ArrowRight size={22} />)}
        </div>
        <p id="sky-instructions">
          Jump on creatures.
          <br />
          Light the beacons.<span>Landscape gives you more sky.</span>
        </p>
        {control("jump", "Jump", <ArrowUp size={24} />)}
      </section>
      <footer className={styles.footer}>
        <span>Original art · Game points only · Best: {best}</span>
        <button
          type="button"
          onClick={() => {
            pause();
            setNotice("To restart, choose a new adventure below.");
          }}
        >
          <RotateCcw size={12} /> Restart
        </button>
      </footer>
      {notice && (
        <div className={styles.notice} role="status">
          <p>{notice}</p>
          <div>
            {notice.startsWith("To restart") && (
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  fresh();
                }}
              >
                New adventure
              </button>
            )}
            <button type="button" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
