"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { GameSwitcher } from "@/components/games/GameSwitcher";
import { ArrowUpRight, Pause, Play, Trophy } from "lucide-react";
import styles from "./Arcade.module.css";
export function useBest(id: string) {
  const [best, setBest] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const n = Number(localStorage.getItem("jktl-arcade-" + id));
      if (Number.isSafeInteger(n) && n >= 0 && n < 1e7)
        timer = setTimeout(() => setBest(n), 0);
    } catch {}
    return () => clearTimeout(timer);
  }, [id]);
  const record = useCallback(
    (score: number) => {
      let previous = 0;
      try {
        previous = Number(localStorage.getItem("jktl-arcade-" + id)) || 0;
      } catch {}
      const value = Math.max(
        score,
        Number.isSafeInteger(previous) && previous < 1e7 ? previous : 0,
      );
      setBest((n) => Math.max(n, value));
      try {
        localStorage.setItem("jktl-arcade-" + id, String(value));
      } catch {}
    },
    [id],
  );
  return { best, record };
}
export function useAutoPause(playing: boolean, pause: () => void) {
  useEffect(() => {
    if (!playing) return;
    const hide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", pause);
    };
  }, [playing, pause]);
}
export function ArcadeFrame({
  id,
  title,
  tag,
  score,
  best,
  playing,
  paused,
  pause,
  resume,
  stat,
  children,
  controls,
}: {
  id: string;
  title: string;
  tag: string;
  score: number;
  best: number;
  playing: boolean;
  paused: boolean;
  pause: () => void;
  resume: () => void;
  stat: string;
  children: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <main className={styles.frame}>
      <header className={styles.header}>
        <a href="https://games.jktl.com.ng" target="_top">
          <Image src="/jktl-logo.png" width={27} height={27} alt="" />
          <b>
            JKTL <span>PLAY</span>
          </b>
        </a>
        <GameSwitcher current={id} onOpen={pause} />
      </header>
      <section className={styles.hud}>
        <div>
          <p>{tag}</p>
          <h1>{title}</h1>
        </div>
        <div>
          <small>POINTS</small>
          <b data-arcade-score>{score}</b>
        </div>
        <div className={styles.best}>
          <small>
            <Trophy size={10} /> BEST
          </small>
          <b>{best}</b>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          disabled={!playing && !paused}
          aria-label={paused ? "Resume game" : "Pause game"}
          onClick={paused ? resume : pause}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
      </section>
      <p className={styles.live} aria-live="off">
        {stat}
      </p>
      <section className={styles.stage}>{children}</section>
      {controls && <div className={styles.controls}>{controls}</div>}
      <footer className={styles.footer}>
        Free guest play · Best scores stay on this device · Game points only
      </footer>
    </main>
  );
}
export function GameOverlay({
  title,
  detail,
  action,
  label,
  children,
}: {
  title: string;
  detail: string;
  action: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.overlay} aria-label="Game menu">
      <p className={styles.kicker}>A LITTLE JKTL PLAY BREAK</p>
      <h2>{title}</h2>
      <p>{detail}</p>
      {children}
      <button type="button" className={styles.primary} onClick={action}>
        {label} <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
export function useCanvasSize() {
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null);
  const size = useRef({
    scale: 1,
    dpr: 1,
    x: 0,
    y: 0,
    width: 360,
    height: 560,
  });
  useEffect(() => {
    const c = canvas.current,
      box = container.current;
    if (!c || !box) return;
    const resize = () => {
      const r = box.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2),
        scale = Math.min(r.width / 360, r.height / 560);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      size.current = {
        scale,
        dpr,
        x: (r.width - 360 * scale) / 2,
        y: (r.height - 560 * scale) / 2,
        width: r.width,
        height: r.height,
      };
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    resize();
    return () => observer.disconnect();
  }, [canvas, container]);
  return { canvas, box: container, size };
}
export { styles };
