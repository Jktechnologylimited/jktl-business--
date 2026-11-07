"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyMixAnswer,
  placeMixTile,
  undoMixTile,
  revealMixHint,
  mixPoints,
  mixRounds,
  mixDifficulty,
  normalizeMixWins,
  MIX_WINS_KEY,
} from "@/lib/arcade-model";
import {
  ArcadeFrame,
  GameOverlay,
  styles,
  useAutoPause,
  useBest,
} from "./shared";
function savedWins() {
  try {
    return normalizeMixWins(Number(localStorage.getItem(MIX_WINS_KEY)));
  } catch {
    return 0;
  }
}
export function WordMix() {
  const [rounds, setRounds] = useState(() => mixRounds(2026)),
    [index, setIndex] = useState(0),
    [wins, setWins] = useState(0),
    [difficulty, setDifficulty] = useState(() => mixDifficulty(0)),
    [loaded, setLoaded] = useState(false),
    [phase, setPhase] = useState("ready"),
    [answer, setAnswer] = useState(() =>
      emptyMixAnswer(mixRounds(2026)[0].word.length),
    ),
    [hints, setHints] = useState(0),
    [seconds, setSeconds] = useState(0),
    [score, setScore] = useState(0),
    [message, setMessage] = useState(""),
    board = useRef<HTMLDivElement>(null);
  const round = rounds[index],
    { best, record } = useBest("word-mix"),
    pause = useCallback(
      () => setPhase((p) => (p === "playing" ? "paused" : p)),
      [],
    );
  useAutoPause(phase === "playing", pause);
  useEffect(() => {
    const timer = setTimeout(() => {
      const completed = savedWins();
      setWins(completed);
      setDifficulty(mixDifficulty(completed));
      const nextRounds = mixRounds(2026, completed);
      setRounds(nextRounds);
      setAnswer(emptyMixAnswer(nextRounds[0].word.length));
      setLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  function choose(i: number) {
    if (
      phase !== "playing" ||
      answer.slots.includes(i) ||
      !answer.slots.includes(null)
    )
      return;
    setAnswer((a) => placeMixTile(a, i));
    setMessage("");
    board.current?.focus();
  }
  function submit() {
    if (phase !== "playing") return;
    if (
      answer.slots
        .map((i) => (i === null ? "_" : round.letters[i]))
        .join("") !== round.word
    ) {
      setMessage("Not quite. Use the clue and mix it again.");
      return;
    }
    const next = score + mixPoints(seconds, hints);
    setScore(next);
    setPhase(index === rounds.length - 1 ? "won" : "round");
    if (index === rounds.length - 1) {
      record(next);
      const completed = Math.min(1_000_000, Math.max(wins, savedWins()) + 1);
      setWins(completed);
      try {
        localStorage.setItem(MIX_WINS_KEY, String(completed));
      } catch {}
    }
  }
  function play() {
    if (!loaded) return;
    setPhase("playing");
    board.current?.focus();
  }
  function next() {
    setIndex((i) => i + 1);
    setAnswer(emptyMixAnswer(rounds[index + 1].word.length));
    setHints(0);
    setSeconds(0);
    setMessage("");
    play();
  }
  function restart() {
    const completed = Math.max(wins, savedWins());
    setWins(completed);
    setDifficulty(mixDifficulty(completed));
    const nextRounds = mixRounds(Date.now() >>> 0, completed);
    setRounds(nextRounds);
    setIndex(0);
    setAnswer(emptyMixAnswer(nextRounds[0].word.length));
    setHints(0);
    setSeconds(0);
    setScore(0);
    setMessage("");
    play();
  }
  return (
    <ArcadeFrame
      id="word-mix"
      title="Naija Word Mix"
      tag="UNSCRAMBLE A LITTLE NIGERIA"
      score={score}
      best={best}
      playing={phase === "playing"}
      paused={phase === "paused"}
      pause={pause}
      resume={play}
      stat={`${difficulty.name} · Word ${index + 1}/5 · ${wins} wins · ${seconds}s`}
      controls={
        <>
          <button
            type="button"
            className={styles.secondary}
            disabled={phase !== "playing" || !answer.history.length}
            onClick={() => setAnswer((a) => undoMixTile(a))}
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={
              phase !== "playing" ||
              hints >= Math.min(round.word.length - 1, difficulty.maxHints) ||
              !answer.slots.some(
                (tile, position) =>
                  tile === null || round.letters[tile] !== round.word[position],
              )
            }
            onClick={() => {
              const revealed = revealMixHint(round.word, round.letters, answer);
              if (!revealed) return;
              setAnswer(revealed.answer);
              setHints(hints + 1);
              setMessage(
                `Letter ${round.word[revealed.position]} placed in position ${revealed.position + 1} and locked. This hint reduces your word score by 25 points.`,
              );
              board.current?.focus();
            }}
            title={`${hints}/${Math.min(round.word.length - 1, difficulty.maxHints)} hints used`}
          >
            Hint −25
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={phase !== "playing" || answer.slots.includes(null)}
            onClick={submit}
          >
            Check word
          </button>
        </>
      }
    >
      <div
        ref={board}
        tabIndex={0}
        className={styles.mixWrap}
        aria-label="Word mixing board"
        onKeyDown={(event) => {
          if (phase !== "playing") return;
          if (/^[a-z]$/i.test(event.key)) {
            event.preventDefault();
            const i = round.letters.findIndex(
              (letter, j) =>
                letter === event.key.toUpperCase() && !answer.slots.includes(j),
            );
            if (i >= 0) choose(i);
          } else if (event.key === "Backspace") {
            event.preventDefault();
            setAnswer((a) => undoMixTile(a));
          } else if (
            event.key === "Enter" &&
            !(event.target instanceof HTMLButtonElement)
          ) {
            event.preventDefault();
            submit();
          }
        }}
      >
        <span className={styles.round}>
          YOUR CLUE · {round.word.length} LETTERS
        </span>
        <h2 className={styles.clue}>{round.clue}</h2>
        <div
          className={styles.slots}
          aria-label={
            "Your answer: " +
            answer.slots
              .map((i) => (i === null ? "_" : round.letters[i]))
              .join("")
          }
          aria-live="polite"
        >
          {[...round.word].map((_, i) => (
            <span
              key={i}
              data-answer-slot={i}
              data-hinted={answer.locked.includes(i) || undefined}
              aria-label={`Position ${i + 1}: ${answer.slots[i] === null ? "empty" : round.letters[answer.slots[i]!]}${answer.locked.includes(i) ? ", revealed by hint, locked" : ""}`}
            >
              {answer.slots[i] === null ? "" : round.letters[answer.slots[i]!]}
            </span>
          ))}
        </div>
        <div className={styles.letters} aria-label="Available letters">
          {round.letters.map((letter, i) => (
            <button
              type="button"
              key={i}
              aria-label={`Letter ${letter}, tile ${i + 1}`}
              disabled={phase !== "playing" || answer.slots.includes(i)}
              onClick={() => choose(i)}
            >
              {letter}
            </button>
          ))}
        </div>
        <p className={styles.mixMessage} role="status">
          {message}
        </p>
        <p className={styles.keyHint}>
          Tap letters, or type them. Hints lock a correct letter in place.
          Backspace undoes your last chosen letter.
        </p>
      </div>
      {phase === "ready" && (
        <GameOverlay
          title="Letters with a little Lagos energy."
          detail={`Complete all five words to earn a win. After 5 wins, longer words and two hints per word await. After 10 wins, take on expert clues with just one hint. Progress saves on this device. Current level: ${difficulty.name}.`}
          action={play}
          label={loaded ? "Mix it up" : "Loading your mix…"}
        />
      )}
      {phase === "paused" && (
        <GameOverlay
          title="Let that word simmer."
          detail="Your answer and timer are paused."
          action={play}
          label="Keep mixing"
        />
      )}
      {phase === "round" && (
        <GameOverlay
          title="That’s the word."
          detail={`${round.word} — ${round.clue}`}
          action={next}
          label="Next clue"
        >
          <p className={styles.result}>{score} points so far</p>
        </GameOverlay>
      )}
      {phase === "won" && (
        <GameOverlay
          title="Five words. Nicely done."
          detail={`${score} points · ${wins} completed wins. ${mixDifficulty(wins).name !== difficulty.name ? `${mixDifficulty(wins).name} unlocked! Your next mix brings longer words, tougher clues and fewer hints.` : difficulty.name === "Expert" ? "Expert level: keep mastering the tougher clues." : `Your next challenge unlocks at ${difficulty.name === "Starter" ? 5 : 10} wins.`}`}
          action={restart}
          label="A fresh mix"
        />
      )}
    </ArcadeFrame>
  );
}
