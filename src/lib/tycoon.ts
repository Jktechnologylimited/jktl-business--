/** Fictional single-player economy. No real securities, payments or rewards. */
export const ventures = [
  {
    id: "suya",
    name: "Suya spot",
    icon: "🍢",
    cost: 90000,
    income: 22000,
    expense: 9000,
    color: "#e38e4f",
  },
  {
    id: "salon",
    name: "Beauty studio",
    icon: "💇🏾‍♀️",
    cost: 150000,
    income: 34000,
    expense: 15000,
    color: "#db9da7",
  },
  {
    id: "provisions",
    name: "Neighbourhood store",
    icon: "🛒",
    cost: 120000,
    income: 28000,
    expense: 12000,
    color: "#e6c56a",
  },
  {
    id: "logistics",
    name: "Dispatch hub",
    icon: "🛵",
    cost: 240000,
    income: 52000,
    expense: 23000,
    color: "#76b6bd",
  },
  {
    id: "solar",
    name: "Solar enterprise",
    icon: "☀️",
    cost: 360000,
    income: 74000,
    expense: 32000,
    color: "#8caad9",
  },
  {
    id: "agency",
    name: "Digital agency",
    icon: "💻",
    cost: 280000,
    income: 60000,
    expense: 25000,
    color: "#ab9dcf",
  },
] as const;
export type VentureId = (typeof ventures)[number]["id"];
export type Plot = { kind: VentureId; level: number };
export type TycoonState = {
  version: 1;
  week: number;
  cash: number;
  city: string;
  plots: (Plot | null)[];
  digital: boolean;
  solar: boolean;
  debt: number;
  log: string[];
};
export const cities = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Kano",
  "Enugu",
  "Ibadan",
] as const;
export const money = (value: number) =>
  "₦" + Math.round(value).toLocaleString("en-NG");
export function newGame(city = "Lagos"): TycoonState {
  return {
    version: 1,
    week: 1,
    cash: 500000,
    city: cities.includes(city as (typeof cities)[number]) ? city : "Lagos",
    plots: Array(12).fill(null),
    digital: false,
    solar: false,
    debt: 0,
    log: ["Welcome! Build your first venture, then advance a week."],
  };
}
export const marketEvents = [
  {
    title: "Payday weekend",
    text: "Neighbourhood spending picks up. Revenue rises 20% this week.",
    revenue: 1.2,
    expense: 1,
  },
  {
    title: "Power pressure",
    text: "An imagined power-cost shock increases operating costs. Solar protection helps.",
    revenue: 1,
    expense: 1.4,
  },
  {
    title: "Made in Nigeria",
    text: "A fictional local-buying campaign lifts demand 15%.",
    revenue: 1.15,
    expense: 1,
  },
  {
    title: "IPO conversation · simulation",
    text: "Inspired by discussion of a potential Dangote refinery listing, investors watch capital markets. This scenario does not confirm an IPO or offer real shares. Business demand is unchanged.",
    revenue: 1,
    expense: 1,
  },
  {
    title: "Digital discovery",
    text: "Customers look online first. A good week to invest in a digital presence.",
    revenue: 1.1,
    expense: 1,
  },
  {
    title: "Delivery delays",
    text: "An imagined logistics disruption reduces revenue by 10%. Keep a cash buffer.",
    revenue: 0.9,
    expense: 1.05,
  },
  {
    title: "Festive bookings",
    text: "An imagined celebration season boosts neighbourhood demand 25%.",
    revenue: 1.25,
    expense: 1.1,
  },
  {
    title: "Steady trade",
    text: "A quieter trading week. Build reserves before your next expansion.",
    revenue: 1,
    expense: 1,
  },
];
export function eventForWeek(week: number) {
  return marketEvents[(week - 1) % marketEvents.length];
}
export function weeklyFigures(state: TycoonState) {
  const event = eventForWeek(state.week);
  let revenue = 0,
    expense = 0;
  for (const plot of state.plots) {
    if (!plot) continue;
    const v = ventures.find((v) => v.id === plot.kind)!;
    revenue +=
      v.income * plot.level * event.revenue * (state.digital ? 1.2 : 1);
    expense += v.expense * plot.level * (state.solar ? 1 : event.expense);
  }
  expense += Math.ceil(state.debt * 0.015);
  return {
    revenue: Math.round(revenue),
    expense: Math.round(expense),
    profit: Math.round(revenue - expense),
  };
}
export function gameAction(
  state: TycoonState,
  action:
    | { type: "build"; slot: number; kind: VentureId }
    | { type: "upgrade"; slot: number }
    | { type: "week" | "digital" | "solar" | "loan" | "repay" },
): TycoonState {
  const next = {
    ...state,
    plots: state.plots.map((p) => (p ? { ...p } : null)),
    log: [...state.log],
  };
  let message = "";
  const spend = (amount: number) => {
    if (next.cash < amount) return false;
    next.cash -= amount;
    return true;
  };
  if (action.type === "build") {
    const v = ventures.find((v) => v.id === action.kind);
    if (
      !v ||
      !Number.isInteger(action.slot) ||
      action.slot < 0 ||
      action.slot >= 12 ||
      next.plots[action.slot] ||
      !spend(v.cost)
    )
      return state;
    next.plots[action.slot] = { kind: v.id, level: 1 };
    message = `Opened ${v.name} for ${money(v.cost)}.`;
  } else if (action.type === "upgrade") {
    const p = next.plots[action.slot];
    if (!p || p.level >= 3) return state;
    const v = ventures.find((v) => v.id === p.kind)!;
    const cost = v.cost * p.level;
    if (!spend(cost)) return state;
    p.level++;
    message = `${v.name} reached level ${p.level}.`;
  } else if (action.type === "digital") {
    if (next.digital || !spend(75000)) return state;
    next.digital = true;
    message = "Digital presence launched. All ventures earn 20% more.";
  } else if (action.type === "solar") {
    if (next.solar || !spend(130000)) return state;
    next.solar = true;
    message =
      "Solar resilience installed. Protected against weekly power-cost shocks.";
  } else if (action.type === "loan") {
    if (next.debt > 0) return state;
    next.cash += 200000;
    next.debt = 200000;
    message =
      "Borrowed ₦200,000 in play money. Interest is ₦3,000 per week until repaid.";
  } else if (action.type === "repay") {
    if (!next.debt || !spend(next.debt)) return state;
    next.debt = 0;
    message = "Loan repaid. No further weekly interest.";
  } else {
    if (next.week >= 260) return state;
    const f = weeklyFigures(state);
    next.cash = Math.max(0, next.cash + f.profit);
    next.week++;
    message = `Week ${state.week}: ${money(f.revenue)} revenue − ${money(f.expense)} costs. ${eventForWeek(state.week).title}.`;
  }
  next.log = [message, ...next.log].slice(0, 12);
  return next;
}
export function parseGame(value: unknown): TycoonState | null {
  if (!value || typeof value !== "object") return null;
  const s = value as TycoonState;
  if (
    s.version !== 1 ||
    !Number.isInteger(s.week) ||
    s.week < 1 ||
    s.week > 260 ||
    !Number.isSafeInteger(s.cash) ||
    s.cash < 0 ||
    s.cash > 1e12 ||
    !cities.includes(s.city as (typeof cities)[number]) ||
    typeof s.digital !== "boolean" ||
    typeof s.solar !== "boolean" ||
    ![0, 200000].includes(s.debt) ||
    !Array.isArray(s.plots) ||
    s.plots.length !== 12 ||
    !s.plots.every(
      (p) =>
        p === null ||
        (p &&
          ventures.some((v) => v.id === p.kind) &&
          Number.isInteger(p.level) &&
          p.level >= 1 &&
          p.level <= 3),
    ) ||
    !Array.isArray(s.log) ||
    s.log.length > 12 ||
    !s.log.every((l) => typeof l === "string" && l.length <= 400)
  )
    return null;
  return {
    version: 1,
    week: s.week,
    cash: s.cash,
    city: s.city,
    digital: s.digital,
    solar: s.solar,
    debt: s.debt,
    plots: s.plots.map((p) => (p ? { kind: p.kind, level: p.level } : null)),
    log: s.log,
  };
}
