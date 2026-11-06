"use client";
import dynamic from "next/dynamic";
import {GameSwitcher} from "@/components/games/GameSwitcher";
import Link from "next/link";
import Image from "next/image";
import { Pause, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  actRun,
  chaseWave,
  runSpeed,
  advanceRun,
  createRun,
  emptyRunRecord,
  parseRunRecord,
  recordRun,
  type RunAction,
  type RunState,
} from "@/lib/runner";
import { RunnerAudio } from "@/lib/runner-audio";
import styles from "./RunnerGame.module.css";
const Scene = dynamic(() => import("./RunnerScene"), {
  ssr: false,
  loading: () => (
    <p className={styles.loading} role="status">
      Loading your street…
    </p>
  ),
});
const SOUND_KEY = "jktl-street-run-sound-v1";
const RECORD_KEY = "jktl-street-run-record-v1";
export function RunnerGame() {
  const skipFrame = useRef(true);
  const audio = useRef<RunnerAudio | null>(null);
  const [sound, setSound] = useState(true);
  const run = useRef(createRun()),
    runId = useRef(""),
    lastHud = useRef(0),
    root = useRef<HTMLElement>(null),
    gesture = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<RunState>(() => createRun()),
    [record, setRecord] = useState(emptyRunRecord),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    audio.current = new RunnerAudio();
    return () => { audio.current?.dispose(); audio.current = null; };
  }, []);
  const read = useCallback(() => run.current, []);
  const fail = useCallback(() => {
    audio.current?.pause();
    skipFrame.current = true;
    run.current = {
      ...run.current,
      phase: run.current.phase === "running" ? "paused" : run.current.phase,
    };
    setView(run.current);
    setError(true);
  }, []);
  const tick = useCallback((delta: number) => {
    if (skipFrame.current) {
      skipFrame.current = false;
      return run.current;
    }
    const previous = run.current,
      next = advanceRun(previous, delta);
    run.current = next;
    audio.current?.update(next);
    const now = performance.now();
    if (next.phase !== previous.phase || now - lastHud.current > 150) {
      lastHud.current = now;
      setView(next);
    }
    return next;
  }, []);
  const action = useCallback((action: RunAction) => {
    const before = run.current;
    run.current = actRun(before, action);
    if (run.current !== before && (action === "jump" || action === "slide")) audio.current?.action(action);
    setView(run.current);
  }, []);
  const pause = useCallback(() => {
    if (run.current.phase === "running") {
      audio.current?.pause();
      skipFrame.current = true;
      run.current = { ...run.current, phase: "paused" };
      setView(run.current);
    }
  }, []);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(motion.matches);
    const frame = requestAnimationFrame(() => {
      sync();
      try {
        const enabled = localStorage.getItem(SOUND_KEY) !== "off";
        setSound(enabled);
        audio.current?.setEnabled(enabled);
        setRecord(
          parseRunRecord(
            JSON.parse(localStorage.getItem(RECORD_KEY) || "null"),
          ),
        );
      } catch {}
    });
    motion.addEventListener("change", sync);
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    const keys = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("input,select,textarea,a")
      )
        return;
      if (
        (event.code === "Escape" || event.code === "KeyP") &&
        run.current.phase === "running"
      ) {
        event.preventDefault();
        pause();
        return;
      }
      if (run.current.phase !== "running") return;
      const control: Record<string, RunAction> = {
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
        ArrowUp: "jump",
        KeyW: "jump",
        Space: "jump",
        ArrowDown: "slide",
        KeyS: "slide",
      };
      if (control[event.code]) {
        event.preventDefault();
        if (!event.repeat) action(control[event.code]);
      }
    };
    window.addEventListener("keydown", keys);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", pause);
      window.removeEventListener("keydown", keys);
    };
  }, [action, pause]);
  useEffect(() => {
    if (view.phase !== "over") return;
    try {
      const existing = parseRunRecord(
        JSON.parse(localStorage.getItem(RECORD_KEY) || "null"),
      );
      const next = recordRun(existing, view, runId.current);
      localStorage.setItem(RECORD_KEY, JSON.stringify(next));
      const frame = requestAnimationFrame(() => setRecord(next));
      return () => cancelAnimationFrame(frame);
    } catch {
      const frame = requestAnimationFrame(() =>
        setRecord((current) => recordRun(current, view, runId.current)),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [view]);
  const chase = chaseWave(view);
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    audio.current?.setEnabled(enabled);
    if (enabled && run.current.phase === "running") audio.current?.unlock();
    try { localStorage.setItem(SOUND_KEY, enabled ? "on" : "off"); } catch {}
  }
  function start() {
    audio.current?.unlock();
    skipFrame.current = true;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    runId.current = crypto.randomUUID?.() || `${seed}-${Date.now()}`;
    run.current = { ...createRun(seed), phase: "running" };
    setView(run.current);
    root.current?.focus();
  }
  function resume() {
    audio.current?.unlock();
    skipFrame.current = true;
    run.current = { ...run.current, phase: "running" };
    setView(run.current);
    root.current?.focus();
  }
  return (
    <main
      ref={root}
      tabIndex={-1}
      className={styles.game}
      data-runner
      data-chaser="masquerade"
      data-sound={sound ? "on" : "off"}
      data-chase-phase={chase.phase}
      data-chase-wave={chase.wave}
      data-chase-gap={chase.gap.toFixed(1)}
      data-run-speed={runSpeed(view.seconds).toFixed(2)}
      data-phase={view.phase}
      data-lane={view.lane}
      data-jumping={view.jumpAge !== null}
      data-sliding={view.slideLeft > 0}
      onPointerDown={(event) => {
        if (event.target instanceof HTMLCanvasElement)
          gesture.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (!start) return;
        const dx = event.clientX - start.x,
          dy = event.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        action(
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "right"
              : "left"
            : dy < 0
              ? "jump"
              : "slide",
        );
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
    >
      <header className={styles.header}>
        <Link href="/play">
          <Image src="/jktl-logo.png" width={32} height={32} alt="" priority />
          <b>JKTL</b>
          <span>STREET RUN</span>
        </Link>
        <GameSwitcher current="run" onOpen={pause}/>
      </header>
      <section className={styles.scoreboard} aria-label="Run score">
        <div>
          <small>POINTS</small>
          <strong data-run-score>{view.score.toLocaleString()}</strong>
        </div>
        <div>
          <small>COINS</small>
          <strong>{view.coins}</strong>
        </div>
        <div>
          <small>DISTANCE</small>
          <strong>{Math.floor(view.distance)} m</strong>
        </div>
        <div>
          <small>PERSONAL BEST</small>
          <strong>{record.best.toLocaleString()}</strong>
        </div>
      </section>
      <div className={styles.scene}>
        {!error && (
          <Scene
            key={attempt}
            read={read}
            tick={tick}
            phase={view.phase}
            onFailure={fail}
            reduced={reduced}
          />
        )}
      </div>
      <button className={styles.sound} onClick={toggleSound} aria-label={sound ? "Mute sounds" : "Enable sounds"} aria-pressed={sound} title={sound ? "Mute sounds" : "Enable sounds"}>
        {sound ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
      </button>
      {view.phase === "running" && (
        <button className={styles.pause} onClick={pause} aria-label="Pause run">
          <Pause size={20} aria-hidden="true" />
        </button>
      )}
      {(error || view.phase !== "running") && (
        <section className={styles.overlay} aria-label="Run menu">
          <p className={styles.eyebrow}>JKTL STREET RUN · NIGERIA</p>
          <h1>
            {error
              ? "Let’s get you running."
              : view.phase === "over"
                ? chase.phase === "caught"
                  ? "The masquerade caught up!"
                  : "An obstacle ended your run."
                : view.phase === "paused"
                  ? "Take a breather."
                  : "Outrun the masquerade."}
          </h1>
          {error ? (
            <>
              <p>
                This 3D game needs WebGL. Enable graphics acceleration or try an
                up-to-date browser, then retry.
              </p>
              <button
                onClick={() => {
                  setError(false);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry 3D
              </button>
            </>
          ) : view.phase === "paused" ? (
            <>
              <p>Your run is paused. Resume when you’re ready.</p>
              <button onClick={resume}>Resume run</button>
            </>
          ) : (
            <>
              <p>
                {view.phase === "over"
                  ? `You earned ${view.score.toLocaleString()} points with ${view.coins} coins over ${Math.floor(view.distance)} metres.`
                  : "You have an 8-metre head start! The masquerade chases, rests and returns as the pace gradually rises. Jump barriers, slide under signs and dodge vehicles to keep your lead."}
              </p>
              <div className={styles.rules}>
                <span>Distance = 5 points / m</span>
                <span>Gold coin = 50 points</span>
              </div>
              <button onClick={start}>
                {view.phase === "over" ? "Run again" : "Start running"}
              </button>
              {view.phase === "over" && (
                <p>
                  Best: {record.best.toLocaleString()} · Total game points:{" "}
                  {record.total.toLocaleString()}
                </p>
              )}
            </>
          )}
          <p className={styles.note}>
            Game points only. Best scores are saved on this device.
          </p>
          {reduced && (
            <p className={styles.note}>
              Reduced motion: decorative effects are minimized. Running starts
              only when you choose Start.
            </p>
          )}
        </section>
      )}
      {view.phase === "running" && (
        <div className={styles.controls} aria-label="Running controls">
          <button aria-label="Move left" onClick={() => action("left")}>
            ←<small>LEFT</small>
          </button>
          <button aria-label="Jump" onClick={() => action("jump")}>
            ↑<small>JUMP</small>
          </button>
          <button aria-label="Slide" onClick={() => action("slide")}>
            ↓<small>SLIDE</small>
          </button>
          <button aria-label="Move right" onClick={() => action("right")}>
            →<small>RIGHT</small>
          </button>
        </div>
      )}
      <footer className={styles.footer} aria-label="Chase status">
        {view.phase === "running"
          ? `${chase.phase === "resting" ? "Masquerade resting" : "Masquerade chasing"} · ${chase.gap.toFixed(1)} m behind · Pace ${(runSpeed(view.seconds) * 3.6).toFixed(0)} km/h`
          : "Arrows / WASD · Space to jump · P to pause · Swipe or use the touch buttons"}
      </footer>
    </main>
  );
}
