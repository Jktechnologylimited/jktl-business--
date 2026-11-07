export function shuffled<T>(values: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const MARKET_ITEMS = [
  { id: "mango", name: "Mango", icon: "🥭" },
  { id: "pepper", name: "Pepper", icon: "🌶️" },
  { id: "coconut", name: "Coconut", icon: "🥥" },
  { id: "banana", name: "Banana", icon: "🍌" },
  { id: "pineapple", name: "Pineapple", icon: "🍍" },
  { id: "tomato", name: "Tomato", icon: "🍅" },
  { id: "basket", name: "Basket", icon: "🧺" },
  { id: "drum", name: "Talking drum", icon: "🥁" },
] as const;
export function memoryDeck(seed: number) {
  return shuffled(
    MARKET_ITEMS.flatMap((item) => [
      { ...item, key: item.id + "-a" },
      { ...item, key: item.id + "-b" },
    ]),
    seed,
  );
}
export const MIX_WORDS = [
  { word: "NAIRA", clue: "Nigeria’s currency." },
  { word: "LAGOS", clue: "A Nigerian coastal city and major business hub." },
  { word: "MARKET", clue: "A place where buyers and sellers meet." },
  {
    word: "BRAND",
    clue: "The identity that helps people recognise a business.",
  },
  { word: "DOMAIN", clue: "Your website’s address on the internet." },
  { word: "GROWTH", clue: "What happens when your business gets bigger." },
  { word: "EMAIL", clue: "A digital message sent to an inbox." },
  { word: "TRADE", clue: "Buying, selling or exchanging goods." },
  { word: "STORE", clue: "A place to shop, online or on your street." },
  { word: "ABUJA", clue: "Nigeria’s capital city." },
  { word: "CLIENT", clue: "Someone who uses your professional services." },
  { word: "JOLLOF", clue: "A beloved West African rice dish." },
] as const;
const MIX_GROWING_WORDS = [
  {
    word: "INVOICE",
    clue: "A request for payment that itemises what was supplied.",
  },
  {
    word: "CAPITAL",
    clue: "Resources committed before an enterprise can grow.",
  },
  {
    word: "REVENUE",
    clue: "The top line, before a business deducts its costs.",
  },
  { word: "PAYMENT", clue: "The exchange that settles an amount owed." },
  {
    word: "NETWORK",
    clue: "Connections that carry information or open opportunities.",
  },
  {
    word: "CUSTOMER",
    clue: "The person whose needs turn an offering into a sale.",
  },
  {
    word: "BUSINESS",
    clue: "An organised venture that supplies goods or services.",
  },
  {
    word: "COMMERCE",
    clue: "The activity linking producers, traders and buyers.",
  },
  {
    word: "DELIVERY",
    clue: "The final journey that puts an order in its buyer’s hands.",
  },
  {
    word: "KEYBOARD",
    clue: "An arrangement of keys that turns finger movements into input.",
  },
  {
    word: "CALABAR",
    clue: "A Cross River capital known for its annual carnival.",
  },
  {
    word: "HARMATTAN",
    clue: "A dry, dusty visitor carried south from the Sahara.",
  },
] as const;
const MIX_EXPERT_WORDS = [
  {
    word: "ENTERPRISE",
    clue: "A venture built through initiative and organised effort.",
  },
  {
    word: "INVESTMENT",
    clue: "A present commitment made in expectation of future returns.",
  },
  {
    word: "NEGOTIATION",
    clue: "The process of finding terms both sides can accept.",
  },
  {
    word: "SUBSCRIPTION",
    clue: "Access maintained through recurring payments.",
  },
  {
    word: "BOOKKEEPING",
    clue: "The systematic recording that lets a business trace its money.",
  },
  {
    word: "FULFILMENT",
    clue: "The work between receiving an order and completing its promise.",
  },
  { word: "INNOVATION", clue: "A useful new approach brought into practice." },
  {
    word: "LOGISTICS",
    clue: "Coordinating movement, storage and timing so goods arrive.",
  },
  {
    word: "PARTNERSHIP",
    clue: "A shared undertaking governed by mutual responsibilities.",
  },
  {
    word: "TRADEMARK",
    clue: "A distinguishing sign that identifies the source of goods.",
  },
  {
    word: "EQUILIBRIUM",
    clue: "The balance point where opposing market forces meet.",
  },
  {
    word: "DIVERSIFY",
    clue: "Spread exposure across different activities or assets.",
  },
] as const;
export const MIX_WINS_KEY = "jktl-word-mix-wins-v1";
export function normalizeMixWins(value: unknown): number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1_000_000
    ? value
    : 0;
}
export function mixDifficulty(wins: number) {
  const completed = normalizeMixWins(wins);
  return completed >= 10
    ? { name: "Expert", maxHints: 1 }
    : completed >= 5
      ? { name: "Challenger", maxHints: 2 }
      : { name: "Starter", maxHints: 6 };
}
export function mixRounds(seed: number, wins = 0) {
  const difficulty = mixDifficulty(wins);
  const pool: readonly { word: string; clue: string }[] =
    difficulty.name === "Expert"
      ? MIX_EXPERT_WORDS
      : difficulty.name === "Challenger"
        ? MIX_GROWING_WORDS
        : MIX_WORDS;
  return shuffled(pool, seed)
    .slice(0, 5)
    .map((item, index) => {
      let letters = shuffled([...item.word], seed + index + 1);
      if (letters.join("") === item.word)
        letters = [...letters.slice(1), letters[0]];
      return { ...item, letters };
    });
}
export function mixPoints(seconds: number, hints: number) {
  return Math.max(
    20,
    200 + Math.max(0, 90 - Math.floor(seconds)) * 2 - hints * 25,
  );
}
export type StackState = {
  phase: "ready" | "playing" | "paused" | "over" | "won";
  floors: { x: number; w: number }[];
  x: number;
  direction: number;
  score: number;
  streak: number;
  perfect: boolean;
  seconds: number;
};
export function newStack(): StackState {
  return {
    phase: "ready",
    floors: [{ x: 80, w: 200 }],
    x: 0,
    direction: 1,
    score: 0,
    streak: 0,
    perfect: false,
    seconds: 0,
  };
}
export function stepStack(state: StackState, delta: number): StackState {
  if (state.phase !== "playing") return state;
  const dt = Math.max(0, Math.min(delta, 0.05)),
    max = 360 - state.floors.at(-1)!.w;
  let x = state.x + state.direction * (95 + state.floors.length * 12) * dt,
    direction = state.direction;
  if (x > max) {
    x = max;
    direction = -1;
  }
  if (x < 0) {
    x = 0;
    direction = 1;
  }
  return { ...state, x, direction, seconds: state.seconds + dt };
}
export function dropStack(state: StackState): StackState {
  if (state.phase !== "playing") return state;
  const last = state.floors.at(-1)!,
    perfect = Math.abs(state.x - last.x) <= 6;
  const x = perfect ? last.x : Math.max(last.x, state.x),
    w = perfect ? last.w : Math.min(last.x + last.w, state.x + last.w) - x;
  if (w < 9) return { ...state, phase: "over", perfect: false };
  const floors = [...state.floors, { x, w }],
    streak = perfect ? state.streak + 1 : 0;
  return {
    ...state,
    floors,
    x: floors.length % 2 ? 0 : 360 - w,
    direction: floors.length % 2 ? 1 : -1,
    score: state.score + (perfect ? 100 + streak * 15 : Math.round(30 + w / 4)),
    streak,
    perfect,
    phase: floors.length >= 21 ? "won" : "playing",
  };
}
export type SliceFruit = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  type: number;
  coal: boolean;
};
export type SliceState = {
  phase: "ready" | "playing" | "paused" | "over";
  seconds: number;
  score: number;
  hearts: number;
  fruits: SliceFruit[];
  nextSpawn: number;
  nextId: number;
  seed: number;
  combo: number;
  lastHit: number;
  burst: { x: number; y: number; colour: number; life: number }[];
};
export function newSlice(seed = 123): SliceState {
  return {
    phase: "ready",
    seconds: 0,
    score: 0,
    hearts: 3,
    fruits: [],
    nextSpawn: 0.35,
    nextId: 1,
    seed: seed >>> 0,
    combo: 0,
    lastHit: -5,
    burst: [],
  };
}
export function stepSlice(state: SliceState, delta: number): SliceState {
  if (state.phase !== "playing") return state;
  const dt = Math.max(0, Math.min(delta, 0.04)),
    seconds = state.seconds + dt;
  let seed = state.seed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let fruits = state.fruits.map((f) => ({
    ...f,
    x: f.x + f.vx * dt,
    y: f.y + f.vy * dt,
    vy: f.vy + 700 * dt,
  }));
  let nextId = state.nextId,
    nextSpawn = state.nextSpawn;
  if (seconds >= nextSpawn) {
    const count = seconds > 20 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const x = 40 + random() * 280;
      fruits.push({
        id: nextId++,
        x,
        y: 590,
        vx: (180 - x) * (0.45 + random() * 0.3),
        vy: -570 - random() * 160,
        r: 22 + random() * 7,
        type: Math.floor(random() * 4),
        coal: seconds > 4 && random() < 0.18,
      });
    }
    nextSpawn = seconds + Math.max(0.65, 1.4 - seconds * 0.011);
  }
  const missed = fruits.filter((f) => f.y > 640 && f.vy > 0 && !f.coal).length,
    hearts = Math.max(0, state.hearts - missed);
  fruits = fruits.filter((f) => f.y < 640 || f.vy < 0);
  return {
    ...state,
    seed,
    seconds,
    fruits,
    nextId,
    nextSpawn,
    hearts,
    phase: hearts === 0 || seconds >= 60 ? "over" : "playing",
    burst: state.burst
      .map((b) => ({ ...b, life: b.life - dt }))
      .filter((b) => b.life > 0),
  };
}
function lineDistance(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax,
    dy = by - ay,
    length = dx * dx + dy * dy,
    t = length
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
      : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
export function sliceLine(
  state: SliceState,
  from: { x: number; y: number },
  to: { x: number; y: number },
): SliceState {
  if (state.phase !== "playing") return state;
  const hits = state.fruits.filter(
    (f) => lineDistance(f.x, f.y, from.x, from.y, to.x, to.y) <= f.r + 4,
  );
  if (!hits.length) return state;
  const coals = hits.filter((f) => f.coal).length,
    fruitHits = hits.length - coals,
    combo = fruitHits
      ? state.seconds - state.lastHit < 0.4
        ? state.combo + fruitHits
        : fruitHits
      : 0,
    hearts = Math.max(0, state.hearts - coals);
  return {
    ...state,
    fruits: state.fruits.filter((f) => !hits.some((h) => h.id === f.id)),
    score: Math.max(
      0,
      state.score + fruitHits * 10 + Math.max(0, combo - 1) * 5 - coals * 25,
    ),
    hearts,
    combo,
    lastHit: state.seconds,
    phase: hearts === 0 ? "over" : "playing",
    burst: [
      ...state.burst,
      ...hits.map((f) => ({
        x: f.x,
        y: f.y,
        colour: f.coal ? -1 : f.type,
        life: 0.45,
      })),
    ],
  };
}

export type MixAnswer = {
  slots: (number | null)[];
  locked: number[];
  history: number[];
};
export function emptyMixAnswer(length: number): MixAnswer {
  return {
    slots: Array<number | null>(length).fill(null),
    locked: [],
    history: [],
  };
}
export function placeMixTile(answer: MixAnswer, tile: number): MixAnswer {
  const position = answer.slots.indexOf(null);
  if (
    position < 0 ||
    tile < 0 ||
    tile >= answer.slots.length ||
    answer.slots.includes(tile)
  )
    return answer;
  const slots = [...answer.slots];
  slots[position] = tile;
  return { ...answer, slots, history: [...answer.history, position] };
}
export function undoMixTile(answer: MixAnswer): MixAnswer {
  const position = answer.history.at(-1);
  if (position === undefined) return answer;
  const slots = [...answer.slots];
  slots[position] = null;
  return { ...answer, slots, history: answer.history.slice(0, -1) };
}
export function revealMixHint(
  word: string,
  letters: readonly string[],
  answer: MixAnswer,
): { answer: MixAnswer; position: number } | null {
  const position = answer.slots.findIndex(
    (tile, index) =>
      !answer.locked.includes(index) &&
      (tile === null || letters[tile] !== word[index]),
  );
  if (position < 0) return null;
  const matches = letters.flatMap((letter, tile) =>
    letter === word[position] ? [tile] : [],
  );
  // Prefer an unused tile, then an incorrectly placed one. Never steal a locked hint.
  const tile =
    matches.find((tile) => !answer.slots.includes(tile)) ??
    matches.find((tile) => {
      const source = answer.slots.indexOf(tile);
      return !answer.locked.includes(source) && letters[tile] !== word[source];
    });
  if (tile === undefined) return null;
  const source = answer.slots.indexOf(tile),
    slots = [...answer.slots];
  if (source >= 0) slots[source] = null;
  slots[position] = tile;
  return {
    position,
    answer: {
      slots,
      locked: [...answer.locked, position],
      history: answer.history.filter(
        (index) => index !== source && index !== position,
      ),
    },
  };
}
