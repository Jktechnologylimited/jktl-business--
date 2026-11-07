import test from "node:test";
import assert from "node:assert/strict";
import {
  memoryDeck,
  mixRounds,
  mixPoints,
  newStack,
  stepStack,
  dropStack,
  newSlice,
  stepSlice,
  sliceLine,
} from "../src/lib/arcade-model.ts";
import { GAMES } from "../src/lib/game-catalog.ts";
test("market decks have exactly eight distinct pairs and reproducible layouts", () => {
  for (let seed = 0; seed < 200; seed++) {
    const deck = memoryDeck(seed);
    assert.equal(deck.length, 16);
    assert.equal(new Set(deck.map((c) => c.key)).size, 16);
    assert.deepEqual(deck, memoryDeck(seed));
    const counts = {};
    for (const c of deck) counts[c.id] = (counts[c.id] || 0) + 1;
    assert.equal(Object.keys(counts).length, 8);
    assert.ok(Object.values(counts).every((n) => n === 2));
  }
});
test("each word mix offers five unique solvable scrambled words, including repeated letters", () => {
  for (let seed = 0; seed < 200; seed++) {
    const rounds = mixRounds(seed);
    assert.equal(new Set(rounds.map((r) => r.word)).size, 5);
    for (const round of rounds) {
      assert.notEqual(round.letters.join(""), round.word);
      assert.equal(
        [...round.word].sort().join(""),
        [...round.letters].sort().join(""),
      );
      assert.ok(round.clue.length > 10);
    }
  }
  assert.equal(mixPoints(90, 0), 200);
  assert.equal(mixPoints(10, 1), 335);
  assert.equal(mixPoints(1000, 100), 20);
});
test("tower clips overhang, rewards perfect streaks, ends on misses and wins only at twenty floors", () => {
  let s = { ...newStack(), phase: "playing" };
  assert.equal(dropStack({ ...s, x: 80 }).floors.at(-1).w, 200);
  assert.equal(dropStack({ ...s, x: 0 }).floors.at(-1).w, 120);
  assert.equal(dropStack({ ...s, x: 300 }).phase, "over");
  for (let i = 0; i < 20; i++) s = dropStack({ ...s, x: s.floors.at(-1).x });
  assert.equal(s.phase, "won");
  assert.equal(s.floors.length, 21);
  assert.equal(s.streak, 20);
  assert.equal(dropStack(s), s);
  assert.equal(stepStack(s, 1), s);
  assert.equal(stepStack(newStack(), 1).x, 0);
  const moved = stepStack({ ...newStack(), phase: "playing" }, 0.05);
  assert.ok(moved.x > 0 && moved.x < 160);
});
const fruit = (id, x, y, coal = false) => ({
  id,
  x,
  y,
  vx: 0,
  vy: 0,
  r: 20,
  type: 0,
  coal,
});
test("slice geometry handles taps and continuous swipes, removes each fruit once and applies coal penalties", () => {
  let s = {
    ...newSlice(),
    phase: "playing",
    seconds: 1,
    fruits: [fruit(1, 100, 100), fruit(2, 200, 200)],
  };
  s = sliceLine(s, { x: 30, y: 30 }, { x: 250, y: 250 });
  assert.equal(s.fruits.length, 0);
  assert.equal(s.score, 25);
  assert.equal(s.combo, 2);
  assert.equal(sliceLine(s, { x: 0, y: 0 }, { x: 300, y: 300 }), s);
  s = { ...s, fruits: [fruit(3, 50, 50, true)], hearts: 1 };
  s = sliceLine(s, { x: 50, y: 50 }, { x: 50, y: 50 });
  assert.equal(s.phase, "over");
  assert.equal(s.hearts, 0);
  assert.equal(s.score, 0);
  assert.equal(sliceLine(s, { x: 0, y: 0 }, { x: 300, y: 300 }), s);
});
test("slice spawning is deterministic, missing fruit costs hearts, coal misses do not, time and pause are bounded", () => {
  let a = { ...newSlice(55), phase: "playing" },
    b = { ...newSlice(55), phase: "playing" };
  for (let i = 0; i < 20; i++) {
    a = stepSlice(a, 0.02);
    b = stepSlice(b, 0.02);
  }
  assert.deepEqual(a, b);
  assert.equal(a.fruits.length, 2);
  assert.ok(a.fruits.every((f) => f.vy < 0));
  assert.equal(stepSlice({ ...a, phase: "paused" }, 1).seconds, a.seconds);
  let missed = stepSlice(
    {
      ...a,
      fruits: [
        { ...fruit(99, 100, 650), vy: 3 },
        { ...fruit(100, 100, 650, true), vy: 3 },
      ],
    },
    0.02,
  );
  assert.equal(missed.hearts, 2);
  assert.equal(
    stepSlice(
      { ...a, hearts: 1, fruits: [{ ...fruit(99, 100, 650), vy: 3 }] },
      0.02,
    ).phase,
    "over",
  );
  assert.equal(stepSlice({ ...a, seconds: 59.99 }, 0.04).phase, "over");
});
test("catalogue has nine unique guest destinations and all four new routes", () => {
  assert.equal(GAMES.length, 9);
  assert.equal(new Set(GAMES.map((g) => g.id)).size, 9);
  assert.equal(GAMES.filter((g) => g.fresh).length, 4);
  for (const g of GAMES) {
    assert.ok(
      g.href.startsWith("/play/") || g.href === "https://fantasy.jktl.com.ng",
    );
    assert.ok(g.cover.startsWith("/game-covers/"));
  }
});

test("word mix advances after five full wins and again at ten, with valid harder puzzles", async () => {
  const { mixDifficulty, normalizeMixWins } =
    await import("../src/lib/arcade-model.ts");
  for (const value of [-1, 1.2, NaN, Infinity, "5", null, 1000001])
    assert.equal(normalizeMixWins(value), 0);
  for (const wins of [0, 1, 4])
    assert.equal(mixDifficulty(wins).name, "Starter");
  for (const wins of [5, 6, 9])
    assert.deepEqual(mixDifficulty(wins), { name: "Challenger", maxHints: 2 });
  for (const wins of [10, 11, 999])
    assert.deepEqual(mixDifficulty(wins), { name: "Expert", maxHints: 1 });
  for (const wins of [0, 4, 5, 9, 10, 50])
    for (let seed = 0; seed < 100; seed++) {
      const rounds = mixRounds(seed, wins);
      assert.deepEqual(rounds, mixRounds(seed, wins));
      assert.equal(new Set(rounds.map((r) => r.word)).size, 5);
      for (const r of rounds) {
        assert.equal(
          [...r.word].sort().join(""),
          [...r.letters].sort().join(""),
        );
        assert.notEqual(r.word, r.letters.join(""));
        assert.ok(r.clue.length > 10);
        assert.ok(r.word.length >= (wins >= 10 ? 9 : wins >= 5 ? 7 : 5));
        assert.ok(r.word.length <= (wins >= 10 ? 12 : wins >= 5 ? 9 : 6));
      }
    }
});

test("word hints place and lock correct tiles without duplicates, including repeated and misplaced letters", async () => {
  const { emptyMixAnswer, placeMixTile, undoMixTile, revealMixHint } =
    await import("../src/lib/arcade-model.ts");
  for (const wins of [0, 5, 10])
    for (let seed = 0; seed < 30; seed++)
      for (const round of mixRounds(seed, wins)) {
        let answer = emptyMixAnswer(round.word.length);
        // Fill every tile in scrambled order, so hints must repair misplaced tiles.
        for (let tile = 0; tile < round.letters.length; tile++)
          answer = placeMixTile(answer, tile);
        let result;
        while ((result = revealMixHint(round.word, round.letters, answer))) {
          answer = result.answer;
          assert.equal(
            round.letters[answer.slots[result.position]],
            round.word[result.position],
          );
          const used = answer.slots.filter((tile) => tile !== null);
          assert.equal(new Set(used).size, used.length);
          for (const position of answer.locked)
            assert.equal(
              round.letters[answer.slots[position]],
              round.word[position],
            );
          assert.ok(answer.locked.length <= round.word.length);
        }
        while (answer.history.length) answer = undoMixTile(answer);
        for (const position of answer.locked)
          assert.equal(
            round.letters[answer.slots[position]],
            round.word[position],
          );
        for (let position = 0; position < round.word.length; position++)
          if (answer.slots[position] === null) {
            const tile = round.letters.findIndex(
              (letter, index) =>
                letter === round.word[position] &&
                !answer.slots.includes(index),
            );
            answer = placeMixTile(answer, tile);
          }
        assert.equal(
          answer.slots.map((tile) => round.letters[tile]).join(""),
          round.word,
        );
        assert.equal(revealMixHint(round.word, round.letters, answer), null);
      }
});
