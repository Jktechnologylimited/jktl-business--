"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { mixPoints, mixRounds } from "@/lib/arcade-model";
import {
  ArcadeFrame,
  GameOverlay,
  styles,
  useAutoPause,
  useBest,
} from "./shared";
export function WordMix() {
  const [rounds, setRounds] = useState(() => mixRounds(2026)),
    [index, setIndex] = useState(0),
    [phase, setPhase] = useState("ready"),
    [answer, setAnswer] = useState<number[]>([]),
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
    if (phase !== "playing") return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  function choose(i: number) {
    if (
      phase !== "playing" ||
      answer.includes(i) ||
      answer.length >= round.word.length
    )
      return;
    setAnswer((a) => [...a, i]);
    setMessage("");
    board.current?.focus();
  }
  function submit() {
    if (phase !== "playing") return;
    if (answer.map((i) => round.letters[i]).join("") !== round.word) {
      setMessage("Not quite. Use the clue and mix it again.");
      return;
    }
    const next = score + mixPoints(seconds, hints);
    setScore(next);
    setPhase(index === rounds.length - 1 ? "won" : "round");
    if (index === rounds.length - 1) record(next);
  }
  function play() {
    setPhase("playing");
    board.current?.focus();
  }
  function next() {
    setIndex((i) => i + 1);
    setAnswer([]);
    setHints(0);
    setSeconds(0);
    setMessage("");
    play();
  }
  function restart() {
    setRounds(mixRounds(Date.now() >>> 0));
    setIndex(0);
    setAnswer([]);
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
      stat={`Word ${index + 1}/5 · ${seconds}s · ${hints} hints used`}
      controls={
        <>
          <button
            type="button"
            className={styles.secondary}
            disabled={phase !== "playing" || !answer.length}
            onClick={() => setAnswer((a) => a.slice(0, -1))}
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={phase !== "playing" || hints >= round.word.length - 1}
            onClick={() => {
              setHints(hints + 1);
              setMessage(
                "Starts with " +
                  round.word.slice(0, hints + 1) +
                  ". Each hint reduces this word’s score by 25 points.",
              );
            }}
          >
            Hint −25
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={
              phase !== "playing" || answer.length !== round.word.length
            }
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
                letter === event.key.toUpperCase() && !answer.includes(j),
            );
            if (i >= 0) choose(i);
          } else if (event.key === "Backspace") {
            event.preventDefault();
            setAnswer((a) => a.slice(0, -1));
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
            "Your answer: " + answer.map((i) => round.letters[i]).join("")
          }
          aria-live="polite"
        >
          {[...round.word].map((_, i) => (
            <span key={i}>
              {answer[i] === undefined ? "" : round.letters[answer[i]]}
            </span>
          ))}
        </div>
        <div className={styles.letters} aria-label="Available letters">
          {round.letters.map((letter, i) => (
            <button
              type="button"
              key={i}
              aria-label={`Letter ${letter}, tile ${i + 1}`}
              disabled={phase !== "playing" || answer.includes(i)}
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
          Tap letters, or type them. Enter checks your word; Backspace undoes.
        </p>
      </div>
      {phase === "ready" && (
        <GameOverlay
          title="Letters with a little Lagos energy."
          detail="Five clues. Five jumbled words. Tap or type the letters in order. Hints can help when you’re stuck."
          action={play}
          label="Mix it up"
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
          detail={`You finished the mix with ${score} points. Try another selection of Nigerian places and business words.`}
          action={restart}
          label="A fresh mix"
        />
      )}
    </ArcadeFrame>
  );
}
