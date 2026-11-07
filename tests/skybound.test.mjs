import test from "node:test";
import assert from "node:assert/strict";
import {
  createSky,
  skyMap,
  stepSky,
  skyEnemyX,
  SKY_ZONES,
} from "../src/lib/skybound.ts";
const idle = { left: false, right: false, jump: false, held: false };
const playing = (level = 0) => ({ ...createSky(level), phase: "playing" });
test("ground, variable jumps, coyote time and paused state are deterministic", () => {
  let a = playing();
  for (let i = 0; i < 120; i++) a = stepSky(a, idle, 1 / 120);
  assert.equal(a.y, 422);
  assert.equal(a.grounded, true);
  const start = stepSky(a, { ...idle, jump: true, held: true }, 1 / 120);
  assert.ok(start.vy < 0);
  assert.equal(start.grounded, false);
  let full = start,
    short = start,
    fullTop = 422,
    shortTop = 422;
  for (let i = 0; i < 100; i++) {
    full = stepSky(full, { ...idle, held: true }, 1 / 120);
    short = stepSky(short, idle, 1 / 120);
    fullTop = Math.min(fullTop, full.y);
    shortTop = Math.min(shortTop, short.y);
  }
  assert.ok(fullTop + 60 < shortTop);
  const edge = { ...a, x: 635, grounded: false, coyote: 0.08 };
  assert.ok(stepSky(edge, { ...idle, jump: true, held: true }, 1 / 120).vy < 0);
  const paused = { ...a, phase: "paused" };
  assert.equal(stepSky(paused, idle, 1), paused);
});
test("gems, checkpoints and defeated creatures cannot be farmed; hazards consume hearts", () => {
  const map = skyMap(0),
    gem = map.gems[0];
  let a = { ...playing(), x: gem.x - 10, y: 400 };
  a = stepSky(a, idle, 1 / 120, map);
  assert.equal(a.score, 10);
  assert.ok(a.collected.includes(gem.id));
  a = stepSky(a, idle, 1 / 120, map);
  assert.equal(a.score, 10);
  let checkpoint = stepSky({ ...playing(), x: 1165 }, idle, 1 / 120, map);
  assert.equal(checkpoint.checkpoint, 1160);
  assert.equal(checkpoint.score, 50);
  checkpoint = stepSky(checkpoint, idle, 1 / 120, map);
  assert.equal(checkpoint.score, 50);
  const enemy = map.enemies[0],
    x = skyEnemyX(enemy, 0, 0);
  let stomp = { ...playing(), x, y: 390, vy: 240, grounded: false };
  for (let i = 0; i < 12 && !stomp.defeated.length; i++)
    stomp = stepSky(stomp, { ...idle, held: true }, 1 / 120, map);
  assert.ok(stomp.defeated.includes(enemy.id));
  assert.equal(stomp.health, 3);
  assert.equal(stomp.score, 25);
  let hurt = stepSky({ ...playing(), x }, idle, 1 / 120, map);
  assert.equal(hurt.health, 2);
  assert.equal(hurt.x, 64);
  assert.ok(hurt.invincible > 0);
  hurt = stepSky({ ...hurt, x }, idle, 1 / 120, map);
  assert.equal(hurt.health, 2);
  const fall = stepSky(
    { ...playing(), y: 650, checkpoint: 1160 },
    idle,
    1 / 120,
    map,
  );
  assert.equal(fall.health, 2);
  assert.equal(fall.x, 1160);
  assert.equal(fall.y, 422);
  const over = stepSky({ ...playing(), health: 1, y: 650 }, idle, 1 / 120, map);
  assert.equal(over.phase, "over");
  const paused = { ...playing(), phase: "paused" };
  assert.equal(stepSky(paused, idle, 1), paused);
});
test("all three worlds have reachable exits and terminal phases stop scoring", () => {
  for (let level = 0; level < SKY_ZONES.length; level++) {
    const map = skyMap(level);
    assert.ok(
      map.solids
        .filter((p) => p.h > 30)
        .every(
          (p, i, list) =>
            i === 0 || p.x - (list[i - 1].x + list[i - 1].w) <= 90,
        ),
    );
    const state = { ...playing(level), x: map.width - 126, vx: 245 };
    let end = stepSky(state, { ...idle, right: true }, 1 / 60, map);
    assert.equal(end.phase, level === 2 ? "won" : "clear");
    assert.ok(end.score >= 200);
    assert.equal(stepSky(end, idle, 1 / 60, map), end);
  }
});
test("a real movement-and-jump controller completes all three authored worlds", () => {
  for (let level = 0; level < 3; level++) {
    const map = skyMap(level);
    let state = playing(level);
    for (let tick = 0; tick < 20000 && state.phase === "playing"; tick++) {
      const obstacles = [
        ...map.solids
          .filter((p) => p.h > 30 && p.x + p.w < map.width)
          .map((p) => ({ x: p.x + p.w - 13, threshold: 75 })),
        ...map.spikes.map((p) => ({ x: p.x, threshold: 70 })),
        ...map.enemies
          .filter((e) => !state.defeated.includes(e.id))
          .map((e) => ({
            x: skyEnemyX(e, state.seconds, level),
            threshold: 90,
          })),
      ];
      const jump =
        state.grounded &&
        obstacles.some((p) => p.x - state.x > 0 && p.x - state.x < p.threshold);
      state = stepSky(
        state,
        { right: true, left: false, jump, held: true },
        1 / 120,
        map,
      );
    }
    assert.equal(state.phase, level === 2 ? "won" : "clear");
    assert.ok(state.health > 0);
    assert.ok(state.collected.length > 0);
    assert.equal(state.checkpoint, 2240);
  }
});
