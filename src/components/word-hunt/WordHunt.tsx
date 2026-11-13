"use client";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowUpRight,
  ArrowRight,
  Check,
  Clock3,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { GameSwitcher } from "@/components/games/GameSwitcher";
import {
  createHunt,
  HUNT_THEMES,
  huntLine,
  huntScore,
  matchHunt,
  type HuntTheme,
} from "@/lib/word-hunt";
import styles from "./WordHunt.module.css";
const colours = [
  "#89c6b0",
  "#d2b1df",
  "#f1bd8f",
  "#a0c5ed",
  "#eed77d",
  "#ecabb7",
  "#91cbd1",
  "#bccb8e",
];
const BEST_KEY = "jktl-word-hunt-best-v1";
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
export function WordHunt({ seed }: { seed: number }) {
  const [puzzle, setPuzzle] = useState(() => createHunt("business", seed)),
    [found, setFound] = useState<string[]>([]),
    [paths, setPaths] = useState<Record<string, number[]>>({}),
    [preview, setPreview] = useState<number[]>([]),
    [anchor, setAnchor] = useState<number | null>(null),
    [phase, setPhase] = useState<"ready" | "playing" | "paused" | "won">(
      "ready",
    ),
    [seconds, setSeconds] = useState(0),
    [hints, setHints] = useState(0),
    [hint, setHint] = useState<number | null>(null),
    [message, setMessage] = useState(
      "Ready when you are. Find your first word.",
    ),
    [best, setBest] = useState(0),
    [focus, setFocus] = useState(0);
  const grid = useRef<HTMLDivElement>(null),
    drag = useRef<{ start: number; end: number; pointer: number } | null>(null),
    saved = useRef<string | null>(null),
    hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const score = huntScore(found, hints),
    theme = HUNT_THEMES[puzzle.theme];
  useEffect(() => {
    try {
      const value = Number(localStorage.getItem(BEST_KEY));
      if (Number.isFinite(value) && value >= 0 && value <= 10000) {
        const timer = setTimeout(() => setBest(value), 0);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setPhase((p) => (p === "playing" ? "paused" : p));
        setAnchor(null);
        setPreview([]);
        drag.current = null;
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (phase !== "won") return;
    const id = puzzle.theme + ":" + puzzle.seed;
    if (saved.current === id) return;
    saved.current = id;
    try {
      const existing = Number(localStorage.getItem(BEST_KEY)) || 0;
      const value = Math.max(
        score,
        Number.isFinite(existing) && existing <= 10000 ? existing : 0,
      );
      localStorage.setItem(BEST_KEY, String(value));
      const timer = setTimeout(() => setBest(value), 0);
      return () => clearTimeout(timer);
    } catch {}
  }, [phase, puzzle, score]);
  const accept = useCallback(
    (start: number, end: number) => {
      const cells = huntLine(start, end, puzzle.size),
        word = matchHunt(puzzle, cells, found);
      setAnchor(null);
      setPreview([]);
      setHint(null);
      if (word) {
        const next = [...found, word];
        setFound(next);
        setPaths((previous) => ({ ...previous, [word]: cells }));
        if (next.length === puzzle.words.length) {
          setPhase("won");
          setMessage("Every word found. Beautifully done!");
        } else
          setMessage(
            `${word} found! ${next.length} of ${puzzle.words.length}.`,
          );
      } else
        setMessage(
          "Not one of the hidden words yet. Try another straight line.",
        );
    },
    [puzzle, found],
  );
  function pick(cell: number) {
    if (phase === "paused" || phase === "won") return;
    if (phase === "ready") setPhase("playing");
    if (anchor === null) {
      setAnchor(cell);
      setPreview([cell]);
      setMessage("Now choose the other end of the word.");
    } else if (anchor === cell) {
      setAnchor(null);
      setPreview([]);
    } else accept(anchor, cell);
  }
  function reset(theme: HuntTheme = puzzle.theme) {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setPuzzle(createHunt(theme, Date.now() >>> 0));
    setFound([]);
    setPaths({});
    setPreview([]);
    setAnchor(null);
    setPhase("ready");
    setSeconds(0);
    setHints(0);
    setHint(null);
    setFocus(0);
    saved.current = null;
    drag.current = null;
    setMessage("Fresh letters. Fresh possibilities. Find your first word.");
  }
  function showHint() {
    if (phase === "paused" || phase === "won") return;
    const word = puzzle.words.find((w) => !found.includes(w.text));
    if (!word) return;
    if (phase === "ready") setPhase("playing");
    setHints((n) => n + 1);
    setHint(word.cells[0]);
    setMessage(
      `Look for ${word.text}. Its first letter is glowing. Hint costs 20 points.`,
    );
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 4000);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -puzzle.size,
      ArrowDown: puzzle.size,
    };
    if (event.key in offsets) {
      event.preventDefault();
      const target = index + offsets[event.key];
      if (
        target < 0 ||
        target >= puzzle.grid.length ||
        (event.key === "ArrowLeft" && index % puzzle.size === 0) ||
        (event.key === "ArrowRight" && index % puzzle.size === puzzle.size - 1)
      )
        return;
      setFocus(target);
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-cell="${target}"]`)
        ?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(index);
    } else if (event.key === "Escape") {
      setAnchor(null);
      setPreview([]);
      setMessage("Selection cleared.");
    }
  }
  const disabled = phase === "paused" || phase === "won";
  return (
    <main className={styles.game}>
      <header className={styles.header}>
        <a
          href="https://games.jktl.com.ng"
          target="_top"
          className={styles.logo}
        >
          <Image src="/jktl-logo.png" alt="" width={33} height={33} />
          <b>
            JKTL <span>PLAY</span>
          </b>
        </a>
        <GameSwitcher
          current="word-hunt"
          onOpen={() => {
            setPhase((current) => (current === "playing" ? "paused" : current));
            setAnchor(null);
            setPreview([]);
            drag.current = null;
          }}
        />
      </header>
      <div className={styles.content}>
        <section className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>
              <Sparkles size={14} /> A LITTLE CHALLENGE. A BIG BRAIN BREAK.
            </p>
            <h1>
              Good words.
              <br />
              <em>Great little wins.</em>
            </h1>
            <p>Find a little Nigeria in every letter.</p>
          </div>
          <div className={styles.sticker} aria-hidden="true">
            <span>W O R D</span>
            <b>HUNT</b>
            <span>MADE FOR YOUR MIND <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" /></span>
          </div>
        </section>
        <div className={styles.layout}>
          <section className={styles.boardCard} aria-label="Word Hunt board">
            <div className={styles.boardTop}>
              <div>
                <p className={styles.eyebrow}>JKTL WORD HUNT</p>
                <h2>{theme.name}</h2>
              </div>
              <div className={styles.progress}>
                <Check size={15} />
                {found.length}/{puzzle.words.length}
              </div>
            </div>
            <div className={styles.stats}>
              <div>
                <span>POINTS</span>
                <strong>{score}</strong>
              </div>
              <div>
                <span>
                  <Clock3 size={11} /> TIME
                </span>
                <strong>{time(seconds)}</strong>
              </div>
              <div>
                <span>
                  <Trophy size={11} /> BEST
                </span>
                <strong>{best}</strong>
              </div>
              <button
                type="button"
                aria-label={
                  phase === "paused" ? "Resume puzzle" : "Pause puzzle"
                }
                disabled={phase === "ready" || phase === "won"}
                onClick={() => {
                  setPhase(phase === "paused" ? "playing" : "paused");
                  setAnchor(null);
                  setPreview([]);
                  drag.current = null;
                }}
              >
                {phase === "paused" ? <Play size={18} /> : <Pause size={18} />}
              </button>
            </div>
            <p className={styles.playTip}>
              Drag a line or tap both ends. Look in all 8 directions.
            </p>
            <ul className={styles.mobileWords} aria-label="Words to find">
              {puzzle.words.map((word, index) => (
                <li
                  key={word.text}
                  data-complete={found.includes(word.text) || undefined}
                  style={
                    found.includes(word.text)
                      ? { background: colours[index % colours.length] }
                      : undefined
                  }
                >
                  {word.text}
                </li>
              ))}
            </ul>
            <div className={styles.boardWrap}>
              <div
                ref={grid}
                className={styles.grid}
                style={{ gridTemplateColumns: `repeat(${puzzle.size},1fr)` }}
                role="group"
                aria-label="Letter grid"
                aria-describedby="hunt-instructions"
                onPointerDown={(event) => {
                  if (disabled || event.button !== 0) return;
                  const tile = (
                    event.target as HTMLElement
                  ).closest<HTMLElement>("[data-cell]");
                  if (!tile) return;
                  event.preventDefault();
                  const cell = Number(tile.dataset.cell);
                  const start = anchor ?? cell;
                  drag.current = { start, end: cell, pointer: event.pointerId };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setFocus(cell);
                  tile.focus();
                  setPreview(huntLine(start, cell, puzzle.size));
                  if (phase === "ready") setPhase("playing");
                }}
                onPointerMove={(event) => {
                  const current = drag.current;
                  if (!current || event.pointerId !== current.pointer) return;
                  const tile = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-cell]");
                  if (!tile || !grid.current?.contains(tile)) return;
                  current.end = Number(tile.dataset.cell);
                  setPreview(huntLine(current.start, current.end, puzzle.size));
                }}
                onPointerUp={(event) => {
                  const current = drag.current;
                  if (!current || event.pointerId !== current.pointer) return;
                  drag.current = null;
                  if (current.start === current.end) {
                    setAnchor(anchor === current.start ? null : current.start);
                    setPreview(anchor === current.start ? [] : [current.start]);
                    setMessage("Choose the other end of the word.");
                  } else accept(current.start, current.end);
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  setPreview([]);
                  setAnchor(null);
                }}
              >
                {puzzle.grid.map((letter, index) => {
                  const word = puzzle.words.find(
                      (w) =>
                        found.includes(w.text) &&
                        (paths[w.text] || w.cells).includes(index),
                    ),
                    tint = word
                      ? colours[puzzle.words.indexOf(word) % colours.length]
                      : undefined;
                  return (
                    <button
                      key={index}
                      data-cell={index}
                      type="button"
                      tabIndex={index === focus ? 0 : -1}
                      disabled={disabled}
                      aria-label={`${letter}, row ${Math.floor(index / puzzle.size) + 1}, column ${(index % puzzle.size) + 1}${word ? ", found" : ""}`}
                      aria-pressed={preview.includes(index)}
                      data-preview={preview.includes(index) || undefined}
                      data-hint={hint === index || undefined}
                      data-found={Boolean(word) || undefined}
                      style={tint ? { backgroundColor: tint } : undefined}
                      onKeyDown={(event) => keyboard(event, index)}
                      onClick={(event) => {
                        if (event.detail === 0) pick(index);
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
              {phase === "paused" && (
                <div className={styles.cover}>
                  <Pause size={28} />
                  <h3>A little breather.</h3>
                  <p>Your puzzle is waiting.</p>
                  <button type="button" onClick={() => setPhase("playing")}>
                    Keep hunting <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {phase === "won" && (
                <div className={styles.cover}>
                  <Trophy size={32} />
                  <h3>Look at you go!</h3>
                  <p>
                    {score} points · {time(seconds)} · {hints} hints
                  </p>
                  <button type="button" onClick={() => reset()}>
                    Another little win <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.boardBottom}>
              <p role="status" aria-live="polite">
                {message}
              </p>
              <div>
                <button type="button" onClick={showHint} disabled={disabled}>
                  <Lightbulb size={16} /> Hint <small>−20</small>
                </button>
                <button type="button" onClick={() => reset()}>
                  <RotateCcw size={15} /> New puzzle
                </button>
              </div>
            </div>
          </section>
          <aside className={styles.side}>
            <section className={styles.wordCard}>
              <p className={styles.eyebrow}>THE LITTLE THINGS TO FIND</p>
              <h2>
                Eight words.
                <br />
                One sharp mind.
              </h2>
              <div className={styles.words}>
                {puzzle.words.map((word, index) => (
                  <div
                    key={word.text}
                    data-complete={found.includes(word.text) || undefined}
                  >
                    <span
                      style={{
                        background: found.includes(word.text)
                          ? colours[index % colours.length]
                          : undefined,
                      }}
                    >
                      {found.includes(word.text) ? (
                        <Check size={13} />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <b>{word.text}</b>
                    {found.includes(word.text) && <Check size={14} />}
                  </div>
                ))}
              </div>
              <div
                className={styles.meter}
                aria-label={`${found.length} of 8 words found`}
              >
                <span
                  style={{
                    width: `${(found.length / puzzle.words.length) * 100}%`,
                  }}
                />
              </div>
              <p className={styles.caption}>{theme.subtitle}</p>
            </section>
            <section className={styles.notes}>
              <label htmlFor="hunt-theme">A different flavour?</label>
              <select
                id="hunt-theme"
                value={puzzle.theme}
                onChange={(event) => reset(event.target.value as HuntTheme)}
              >
                {Object.entries(HUNT_THEMES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name}
                  </option>
                ))}
              </select>
              <details>
                <summary>How to play</summary>
                <p id="hunt-instructions">
                  Drag from the first letter to the last, or tap both ends.
                  Words go across, down, diagonally and backwards. Keyboard: use
                  arrow keys to move, Enter or Space to select both ends, Escape
                  to cancel.
                </p>
                <p>
                  Earn 10 points per letter. Hints cost 20 points. No time
                  limit. Best score stays on this device. Game points have no
                  cash value.
                </p>
              </details>
            </section>
          </aside>
        </div>
        <footer className={styles.footer}>
          A good moment, by JKTL.{" "}
          <a href="https://games.jktl.com.ng" target="_top">
            Find your next game <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
          </a>
        </footer>
      </div>
    </main>
  );
}
