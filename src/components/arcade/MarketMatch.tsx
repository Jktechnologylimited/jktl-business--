"use client";
import { useCallback, useEffect, useState } from "react";
import { memoryDeck } from "@/lib/arcade-model";
import {
  ArcadeFrame,
  GameOverlay,
  styles,
  useAutoPause,
  useBest,
} from "./shared";
type Pending = {
  a: number;
  b: number;
  match: boolean;
  score: number;
  streak: number;
  matches: number[];
  finished: boolean;
};
export function MarketMatch() {
  const [deck, setDeck] = useState(() => memoryDeck(41)),
    [phase, setPhase] = useState("ready"),
    [first, setFirst] = useState<number | null>(null),
    [pending, setPending] = useState<Pending | null>(null),
    [matched, setMatched] = useState<number[]>([]),
    [moves, setMoves] = useState(0),
    [seconds, setSeconds] = useState(0),
    [score, setScore] = useState(0),
    [streak, setStreak] = useState(0),
    [message, setMessage] = useState("Find two matching market treasures.");
  const { best, record } = useBest("market-match"),
    pause = useCallback(
      () => setPhase((p) => (p === "playing" ? "paused" : p)),
      [],
    );
  useAutoPause(phase === "playing", pause);
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (!pending || phase !== "playing") return;
    const timer = setTimeout(
      () => {
        setMatched(pending.matches);
        setScore(pending.score);
        setStreak(pending.streak);
        setFirst(null);
        setPending(null);
        setMessage(
          pending.match
            ? "A perfect pair. Keep that streak going!"
            : "Different treasures. Try another pair.",
        );
        if (pending.finished) {
          setPhase("won");
          record(pending.score);
        }
      },
      pending.match ? 350 : 750,
    );
    return () => clearTimeout(timer);
  }, [pending, phase, record]);
  function flip(index: number) {
    if (
      phase !== "playing" ||
      pending ||
      matched.includes(index) ||
      first === index
    )
      return;
    if (first === null) {
      setFirst(index);
      return;
    }
    const match = deck[first].id === deck[index].id,
      matches = match ? [...matched, first, index] : matched,
      finished = matches.length === 16,
      next = match ? score + 100 + (streak + 1) * 25 : Math.max(0, score - 5);
    setMoves((n) => n + 1);
    setPending({
      a: first,
      b: index,
      match,
      matches,
      streak: match ? streak + 1 : 0,
      finished,
      score: finished ? next + Math.max(0, 180 - seconds) * 2 : next,
    });
  }
  function restart() {
    setDeck(memoryDeck(Date.now() >>> 0));
    setFirst(null);
    setPending(null);
    setMatched([]);
    setMoves(0);
    setSeconds(0);
    setScore(0);
    setStreak(0);
    setMessage("Fresh market. Fresh memory.");
    setPhase("playing");
  }
  return (
    <ArcadeFrame
      id="market-match"
      title="Market Match"
      tag="A LITTLE MEMORY MAGIC"
      score={score}
      best={best}
      playing={phase === "playing"}
      paused={phase === "paused"}
      pause={pause}
      resume={() => setPhase("playing")}
      stat={`${matched.length / 2}/8 pairs · ${moves} moves · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
      controls={
        <button type="button" className={styles.secondary} onClick={restart}>
          New market
        </button>
      }
    >
      <div className={styles.memoryWrap}>
        <div className={styles.memoryGrid} aria-label="Market memory cards">
          {deck.map((item, index) => {
            const open =
              first === index ||
              pending?.b === index ||
              matched.includes(index);
            return (
              <button
                type="button"
                key={item.key}
                data-card={index}
                data-open={open || undefined}
                data-matched={matched.includes(index) || undefined}
                className={styles.memoryCard}
                disabled={
                  phase !== "playing" ||
                  Boolean(pending) ||
                  matched.includes(index)
                }
                aria-label={
                  open
                    ? `${item.name}, card ${index + 1}${matched.includes(index) ? ", matched" : ""}`
                    : `Hidden card ${index + 1}`
                }
                onClick={() => flip(index)}
              >
                {open ? (
                  <>
                    <span className={styles.emoji} aria-hidden="true">
                      {item.icon}
                    </span>
                    <small>{item.name}</small>
                  </>
                ) : (
                  <span aria-hidden="true">✦</span>
                )}
              </button>
            );
          })}
        </div>
        <p className={styles.memoryNote} role="status">
          {message}
        </p>
      </div>
      {phase === "ready" && (
        <GameOverlay
          title="A market full of matches."
          detail="Flip two cards. Find all eight matching pairs. Remember what you’ve seen and build a matching streak."
          action={() => setPhase("playing")}
          label="Open the market"
        />
      )}
      {phase === "paused" && (
        <GameOverlay
          title="Your market can wait."
          detail="Your cards, moves and timer are paused."
          action={() => setPhase("playing")}
          label="Keep matching"
        />
      )}
      {phase === "won" && (
        <GameOverlay
          title="A beautiful memory."
          detail={`${moves} moves · ${seconds} seconds · ${score} points. Try a new layout and beat your device best.`}
          action={restart}
          label="Play another market"
        >
          <p className={styles.celebrate} aria-hidden="true">
            🧺 ✨
          </p>
        </GameOverlay>
      )}
    </ArcadeFrame>
  );
}
