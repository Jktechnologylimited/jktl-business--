export const HUNT_SIZE = 9;
export const HUNT_THEMES = {
  business: {
    name: "Build your business",
    subtitle: "Big ideas start with a word.",
    words: [
      "BUSINESS",
      "WEBSITE",
      "DOMAIN",
      "BRAND",
      "GROWTH",
      "SALES",
      "CLIENT",
      "EMAIL",
    ],
  },
  nigeria: {
    name: "Around Nigeria",
    subtitle: "Find your next stop, one letter at a time.",
    words: [
      "LAGOS",
      "ABUJA",
      "ENUGU",
      "KANO",
      "IBADAN",
      "UYO",
      "CALABAR",
      "KADUNA",
    ],
  },
  food: {
    name: "Taste of Naija",
    subtitle: "A delicious little brain break.",
    words: [
      "JOLLOF",
      "SUYA",
      "AKARA",
      "EGUSI",
      "AMALA",
      "MOIMOI",
      "EBA",
      "OGBONO",
    ],
  },
} as const;
export type HuntTheme = keyof typeof HUNT_THEMES;
export type HuntPuzzle = {
  size: number;
  grid: string[];
  words: { text: string; cells: number[] }[];
  theme: HuntTheme;
  seed: number;
};
const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];
export function huntLine(
  start: number,
  end: number,
  size = HUNT_SIZE,
): number[] {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < 0 ||
    start >= size * size ||
    end >= size * size
  )
    return [];
  const r = Math.floor(start / size),
    c = start % size,
    dr = Math.floor(end / size) - r,
    dc = (end % size) - c;
  if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return [];
  return Array.from(
    { length: Math.max(Math.abs(dr), Math.abs(dc)) + 1 },
    (_, n) => (r + Math.sign(dr) * n) * size + c + Math.sign(dc) * n,
  );
}
/** Seeded placement with a guaranteed row fallback; every advertised word exists. */
export function createHunt(theme: HuntTheme, seed: number): HuntPuzzle {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const grid = Array<string>(HUNT_SIZE * HUNT_SIZE).fill("");
  const words: HuntPuzzle["words"] = [];
  for (const text of [...HUNT_THEMES[theme].words].sort(
    (a, b) => b.length - a.length,
  )) {
    const candidates: number[][] = [];
    for (let row = 0; row < HUNT_SIZE; row++)
      for (let col = 0; col < HUNT_SIZE; col++)
        for (const [dr, dc] of directions) {
          const er = row + dr * (text.length - 1),
            ec = col + dc * (text.length - 1);
          if (er < 0 || er >= HUNT_SIZE || ec < 0 || ec >= HUNT_SIZE) continue;
          const cells = Array.from(
            { length: text.length },
            (_, k) => (row + dr * k) * HUNT_SIZE + col + dc * k,
          );
          if (cells.every((cell, k) => !grid[cell] || grid[cell] === text[k]))
            candidates.push(cells);
        }
    if (!candidates.length) {
      // Restart with separate rows if a dense random arrangement blocks a long word.
      grid.fill("");
      words.length = 0;
      HUNT_THEMES[theme].words.forEach((word, row) => {
        const reverse = random() < 0.5,
          start = Math.floor(random() * (HUNT_SIZE - word.length + 1));
        const cells = Array.from(
          { length: word.length },
          (_, i) =>
            row * HUNT_SIZE + start + (reverse ? word.length - 1 - i : i),
        );
        cells.forEach((cell, i) => {
          grid[cell] = word[i];
        });
        words.push({ text: word, cells });
      });
      break;
    }
    const cells = candidates[Math.floor(random() * candidates.length)];
    cells.forEach((cell, i) => {
      grid[cell] = text[i];
    });
    words.push({ text, cells });
  }
  return {
    size: HUNT_SIZE,
    theme,
    seed,
    words,
    grid: grid.map(
      (letter) =>
        letter || "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(random() * 26)],
    ),
  };
}
export function matchHunt(
  puzzle: HuntPuzzle,
  cells: number[],
  found: readonly string[],
): string | null {
  if (
    cells.length < 2 ||
    huntLine(cells[0], cells.at(-1)!, puzzle.size).join(",") !== cells.join(",")
  )
    return null;
  const text = cells.map((cell) => puzzle.grid[cell]).join("");
  return (
    puzzle.words.find(
      (word) =>
        !found.includes(word.text) &&
        (word.text === text || word.text === [...text].reverse().join("")),
    )?.text || null
  );
}
export function huntScore(found: readonly string[], hints: number): number {
  return Math.max(
    0,
    found.reduce((sum, word) => sum + word.length * 10, 0) - hints * 20,
  );
}
