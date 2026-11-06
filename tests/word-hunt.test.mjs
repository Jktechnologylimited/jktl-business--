import test from "node:test";
import assert from "node:assert/strict";
import {
  createHunt,
  HUNT_THEMES,
  huntLine,
  matchHunt,
  huntScore,
} from "../src/lib/word-hunt.ts";
test("every theme is reproducible and all advertised words are selectable in 600 generated puzzles", () => {
  for (const theme of Object.keys(HUNT_THEMES))
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = createHunt(theme, seed);
      assert.deepEqual(puzzle, createHunt(theme, seed));
      assert.equal(puzzle.grid.length, 81);
      assert.equal(puzzle.words.length, 8);
      assert.ok(puzzle.grid.every((c) => /^[A-Z]$/.test(c)));
      for (const word of puzzle.words) {
        assert.equal(word.cells.map((i) => puzzle.grid[i]).join(""), word.text);
        assert.deepEqual(
          huntLine(word.cells[0], word.cells.at(-1)),
          word.cells,
        );
        assert.equal(matchHunt(puzzle, word.cells, []), word.text);
        assert.equal(
          matchHunt(puzzle, [...word.cells].reverse(), []),
          word.text,
        );
        assert.equal(matchHunt(puzzle, word.cells, [word.text]), null);
      }
    }
});
test("selection cannot wrap rows, skip cells or form non-straight paths; hints never give negative scores", () => {
  assert.deepEqual(huntLine(0, 20), [0, 10, 20]);
  assert.deepEqual(huntLine(20, 0), [20, 10, 0]);
  assert.deepEqual(huntLine(0, 11), []);
  assert.deepEqual(huntLine(-1, 1), []);
  assert.deepEqual(huntLine(0, 81), []);
  const puzzle = createHunt("business", 42);
  assert.equal(matchHunt(puzzle, [], []), null);
  assert.equal(matchHunt(puzzle, [0], []), null);
  assert.equal(matchHunt(puzzle, [0, 2, 4], []), null);
  assert.equal(huntScore(["BUSINESS"], 1), 60);
  assert.equal(huntScore([], 5), 0);
});
