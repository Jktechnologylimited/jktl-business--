export type Platform = { x: number; y: number; w: number; h: number };
export type SkyInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  held: boolean;
};
export const SKY_ZONES = [
  {
    name: "Palmwater Coast",
    caption: "Follow the light beyond the lagoon.",
    sky: "#a4d7d6",
    horizon: "#e9e2b6",
    water: "#58a8ad",
    soil: "#a9674b",
    grass: "#438b70",
    night: false,
  },
  {
    name: "Copperleaf Market",
    caption: "Every rooftop has a story.",
    sky: "#eec29f",
    horizon: "#f7e0ad",
    water: "#be9685",
    soil: "#995a49",
    grass: "#7c8852",
    night: false,
  },
  {
    name: "Lantern Heights",
    caption: "Bring the last light home.",
    sky: "#19284a",
    horizon: "#765b7c",
    water: "#344b72",
    soil: "#4a4463",
    grass: "#6da89c",
    night: true,
  },
] as const;
export type SkyMap = {
  width: number;
  solids: Platform[];
  gems: { id: number; x: number; y: number }[];
  enemies: { id: number; x: number; min: number; max: number }[];
  spikes: Platform[];
  checkpoints: number[];
};
export function skyMap(level: number): SkyMap {
  const width = 3300 + level * 300;
  const solids: Platform[] = [
    { x: 0, y: 460, w: 620, h: 100 },
    { x: 710, y: 460, w: 630, h: 100 },
    { x: 1430, y: 460, w: 600, h: 100 },
    { x: 2120, y: 460, w: width - 2120, h: 100 },
    ...[
      [250, 365, 130],
      [450, 290, 125],
      [860, 355, 135],
      [1110, 285, 140],
      [1550, 365, 140],
      [1770, 290, 140],
      [2220, 355, 160],
      [2460, 285, 150],
      [2740, 360, 135],
    ].map(([x, y, w]) => ({ x, y, w, h: 22 })),
  ];
  const gems: SkyMap["gems"] = [];
  for (const p of solids) {
    if (p.h > 30) {
      for (let x = p.x + 170; x < p.x + p.w - 50; x += 175)
        gems.push({ id: gems.length, x, y: 420 });
    } else
      for (let x = p.x + 27; x < p.x + p.w - 10; x += 42)
        gems.push({ id: gems.length, x, y: p.y - 32 });
  }
  const enemies = [
    { id: 0, x: 400, min: 360, max: 555 },
    { id: 1, x: 1540, min: 1480, max: 1670 },
    { id: 2, x: 2600, min: 2520, max: 2740 },
  ];
  if (level > 0) enemies.push({ id: 3, x: 1080, min: 1040, max: 1110 });
  if (level > 1) enemies.push({ id: 4, x: 2920, min: 2830, max: 3070 });
  return {
    width,
    solids,
    gems,
    enemies,
    spikes: [
      { x: 990, y: 444, w: 42, h: 16 },
      { x: 1850, y: 444, w: 42, h: 16 },
      ...(level > 0 ? [{ x: 2360, y: 444, w: 42, h: 16 }] : []),
    ],
    checkpoints: [1160, 2240],
  };
}
export type SkyState = {
  level: number;
  phase: "ready" | "playing" | "paused" | "clear" | "over" | "won";
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: number;
  coyote: number;
  buffer: number;
  health: number;
  score: number;
  collected: number[];
  defeated: number[];
  checkpoint: number;
  invincible: number;
  seconds: number;
  events: string[];
};
export function createSky(level = 0, score = 0, health = 3): SkyState {
  return {
    level,
    phase: "ready",
    x: 64,
    y: 422,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    coyote: 0.1,
    buffer: 0,
    health,
    score,
    collected: [],
    defeated: [],
    checkpoint: 64,
    invincible: 0,
    seconds: 0,
    events: [],
  };
}
export function skyEnemyX(
  enemy: SkyMap["enemies"][number],
  seconds: number,
  level: number,
) {
  const span = enemy.max - enemy.min,
    p = (seconds * (50 + level * 12) + enemy.x - enemy.min) % (span * 2);
  return enemy.min + (p < span ? p : span * 2 - p);
}
const overlap = (a: Platform, b: Platform) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Fixed-size simulation steps are shared by renderer and tests; no DOM or server state. */
export function stepSky(
  previous: SkyState,
  input: SkyInput,
  delta: number,
  map = skyMap(previous.level),
): SkyState {
  if (previous.phase !== "playing") return previous;
  const dt = Math.max(0, Math.min(delta, 1 / 60));
  const s: SkyState = {
    ...previous,
    seconds: previous.seconds + dt,
    events: [],
    invincible: Math.max(0, previous.invincible - dt),
    buffer: input.jump ? 0.13 : Math.max(0, previous.buffer - dt),
    coyote: previous.grounded ? 0.1 : Math.max(0, previous.coyote - dt),
  };
  const direction = Number(input.right) - Number(input.left),
    target = direction * 245;
  s.vx += Math.max(-1300 * dt, Math.min(1300 * dt, target - s.vx));
  if (direction) s.facing = direction;
  if (s.buffer > 0 && s.coyote > 0) {
    s.vy = -650;
    s.buffer = 0;
    s.coyote = 0;
    s.grounded = false;
    s.events.push("jump");
  }
  if (!input.held && s.vy < -250) s.vy = -250;
  s.vy += 1650 * dt;
  const oldBottom = s.y + 38;
  s.x = Math.max(0, Math.min(map.width - 28, s.x + s.vx * dt));
  s.y += s.vy * dt;
  s.grounded = false;
  for (const p of map.solids)
    if (
      s.x + 26 > p.x &&
      s.x < p.x + p.w &&
      oldBottom <= p.y + 0.5 &&
      s.y + 38 >= p.y &&
      s.vy >= 0
    ) {
      s.y = p.y - 38;
      s.vy = 0;
      s.grounded = true;
    }
  for (const checkpoint of map.checkpoints)
    if (s.x >= checkpoint && s.checkpoint < checkpoint) {
      s.checkpoint = checkpoint;
      s.score += 50;
      s.events.push("checkpoint");
    }
  for (const gem of map.gems)
    if (
      !s.collected.includes(gem.id) &&
      overlap(
        { x: s.x, y: s.y, w: 26, h: 38 },
        { x: gem.x - 10, y: gem.y - 10, w: 20, h: 20 },
      )
    ) {
      s.collected = [...s.collected, gem.id];
      s.score += 10;
      s.events.push("gem");
    }
  const hurt = () => {
    if (s.invincible > 0) return;
    s.health--;
    s.events.push("hurt");
    s.invincible = 2;
    s.x = s.checkpoint;
    s.y = 422;
    s.vx = 0;
    s.vy = 0;
    s.coyote = 0.1;
    s.buffer = 0;
    s.grounded = true;
    if (s.health <= 0) s.phase = "over";
  };
  const box = { x: s.x + 3, y: s.y + 2, w: 20, h: 35 };
  if (s.y > 600) {
    s.invincible = 0;
    hurt();
    return s;
  }
  if (map.spikes.some((p) => overlap(box, p))) {
    hurt();
    return s;
  }
  for (const enemy of map.enemies)
    if (!s.defeated.includes(enemy.id)) {
      const ex = skyEnemyX(enemy, s.seconds, s.level);
      if (overlap(box, { x: ex, y: 432, w: 30, h: 28 })) {
        if (oldBottom <= 442 && s.vy > 0) {
          s.defeated = [...s.defeated, enemy.id];
          s.vy = -410;
          s.score += 25;
          s.events.push("stomp");
        } else {
          hurt();
          return s;
        }
      }
    }
  if (s.x >= map.width - 125) {
    s.score += 200;
    s.phase = s.level === SKY_ZONES.length - 1 ? "won" : "clear";
    s.events.push("clear");
  }
  return s;
}
