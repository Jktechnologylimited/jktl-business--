"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  cities,
  eventForWeek,
  gameAction,
  money,
  newGame,
  parseGame,
  ventures,
  weeklyFigures,
  type TycoonState,
  type VentureId,
} from "@/lib/tycoon";
import styles from "./TycoonGame.module.css";
function CityMap({
  state,
  slot,
  onSlot,
}: {
  state: TycoonState;
  slot: number;
  onSlot: (slot: number) => void;
}) {
  return (
    <svg
      className={styles.map}
      viewBox="0 0 900 620"
      role="group"
      aria-label="Interactive business neighbourhood. Select an empty plot to build or an existing business to upgrade."
    >
      <defs>
        <pattern
          id="grass"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <rect width="30" height="30" fill="#92b877" />
          <circle cx="8" cy="10" r="1" fill="#fff" opacity=".15" />
        </pattern>
        <filter id="shadow">
          <feDropShadow dx="0" dy="8" stdDeviation="5" floodOpacity=".15" />
        </filter>
      </defs>
      <rect width="900" height="620" rx="24" fill="url(#grass)" />
      <path
        d="M0 192H900M0 380H900M220 0V620M450 0V620M680 0V620"
        stroke="#6b767a"
        strokeWidth="40"
      />
      <path
        d="M0 192H900M0 380H900M220 0V620M450 0V620M680 0V620"
        stroke="#e3dbb5"
        strokeWidth="2"
        strokeDasharray="12 12"
      />
      {state.plots.map((plot, i) => {
        const x = 110 + (i % 4) * 230,
          y = 110 + Math.floor(i / 4) * 190;
        const v = ventures.find((v) => v.id === plot?.kind);
        return (
          <g
            key={i}
            tabIndex={0}
            role="button"
            aria-label={`Plot ${i + 1}: ${v ? `${v.name}, level ${plot!.level}` : "empty"}`}
            aria-pressed={slot === i}
            onClick={() => onSlot(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSlot(i);
              }
            }}
            className={styles.plot}
            transform={`translate(${x},${y})`}
          >
            <ellipse
              rx="88"
              ry="47"
              cy="25"
              fill={slot === i ? "#c9a84c" : "#c2d7a3"}
              stroke={slot === i ? "#060e2a" : "#e3eccd"}
              strokeWidth={slot === i ? 4 : 2}
            />
            {v ? (
              <g filter="url(#shadow)">
                <path
                  d={`M-58 18V-${36 + plot!.level * 15}L0 -${59 + plot!.level * 15}L58 -${36 + plot!.level * 15}V18L0 45Z`}
                  fill={v.color}
                />
                <path
                  d={`M0 -${59 + plot!.level * 15}L58 -${36 + plot!.level * 15}L0 -${12 + plot!.level * 15}L-58 -${36 + plot!.level * 15}Z`}
                  fill="#fdfcf8"
                />
                <path
                  d={`M0 -${12 + plot!.level * 15}V45L58 18V-${36 + plot!.level * 15}Z`}
                  fill="#060e2a"
                  opacity=".2"
                />
                {Array.from({ length: plot!.level }, (_, j) => (
                  <g key={j}>
                    <path
                      d={`M-42 ${-12 - j * 16}l12 5v10l-12 -5Z M-22 ${-4 - j * 16}l12 5v10l-12 -5Z M15 ${-j * 16}l12 -5v10l-12 5Z M35 ${-8 - j * 16}l12 -5v10l-12 5Z`}
                      fill="#40566c"
                    />
                  </g>
                ))}
                <text
                  y={-48 - plot!.level * 15}
                  textAnchor="middle"
                  fontSize="30"
                >
                  {v.icon}
                </text>
                <rect
                  x="-90"
                  y="48"
                  width="180"
                  height="27"
                  rx="13"
                  fill="#060e2a"
                />
                <text y="66" textAnchor="middle" fontSize="12" fill="white">
                  {v.name} · L{plot!.level}
                </text>
              </g>
            ) : (
              <>
                <text y="20" textAnchor="middle" fontSize="28" fill="#436144">
                  +
                </text>
                <text y="43" textAnchor="middle" fontSize="11" fill="#29412c">
                  BUILD HERE
                </text>
              </>
            )}
          </g>
        );
      })}
      <text x="25" y="595" fill="#203826" fontSize="13">
        {state.city} · Your neighbourhood, your ambition.
      </text>
    </svg>
  );
}
export function TycoonGame() {
  const [state, setState] = useState<TycoonState>(newGame);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Loading your neighbourhood…");
  const [slot, setSlot] = useState(0);
  const [kind, setKind] = useState<VentureId>("suya");
  const [busy, setBusy] = useState(false);
  const [restart, setRestart] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = parseGame(
          JSON.parse(localStorage.getItem("jktl-tycoon-guest-v1") || "null"),
        );
        if (saved) setState(saved);
      } catch {}
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch("/api/tycoon", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!active) return;
        if (!r.ok) throw Error(data.error);
        setSignedIn(data.signedIn === true);
        setRevision(data.revision ?? 0);
        const saved = parseGame(data.document);
        if (saved) setState(saved);
        setStatus(
          data.signedIn
            ? "Your JKTL account is connected. Save when you are ready."
            : "Guest trial · progress stays in this browser.",
        );
      })
      .catch(() => {
        if (active)
          setStatus(
            "Account connection unavailable. You can still play as a guest.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setReady(true);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (ready && !signedIn)
      try {
        localStorage.setItem("jktl-tycoon-guest-v1", JSON.stringify(state));
      } catch {}
  }, [state, ready, signedIn]);
  const figures = weeklyFigures(state),
    event = eventForWeek(state.week),
    plot = state.plots[slot],
    chosen = ventures.find((v) => v.id === kind)!,
    built = state.plots.filter(Boolean).length;
  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/tycoon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: state, revision }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setRevision(data.revision);
      setStatus("Saved to your JKTL account.");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.game}>
      <header className={styles.header}>
        <Link href="/business">
          JKTL <span>BUSINESS</span>
        </Link>
        <nav>
          <Link href="https://jktl.com.ng">Main site ↗</Link>
          {signedIn ? (
            <Link href="/business">My dashboard</Link>
          ) : (
            <Link href="/login?next=tycoon">Sign in to save</Link>
          )}
        </nav>
      </header>
      <div className={styles.intro}>
        <div>
          <p>NIGERIA · BUILD YOUR NEXT CHAPTER</p>
          <h1>JKTL Business Tycoon</h1>
          <p>
            Start small. Think big. Build a thriving Nigerian neighbourhood.
          </p>
        </div>
        <span className={styles.badge}>2026 edition · Free to play</span>
      </div>
      <div className={styles.stats}>
        <div>
          <small>Cash available</small>
          <strong>{money(state.cash)}</strong>
        </div>
        <div>
          <small>Trading week</small>
          <strong>{state.week} / 260</strong>
        </div>
        <div>
          <small>Projected weekly profit</small>
          <strong>{money(figures.profit)}</strong>
        </div>
        <div>
          <small>Businesses opened</small>
          <strong>{built} / 12</strong>
        </div>
      </div>
      <div className={styles.layout}>
        <section className={styles.neighbourhood}>
          <div className={styles.mapHeader}>
            <label>
              Your city{" "}
              <select
                value={state.city}
                disabled={!ready}
                onChange={(e) =>
                  setState((s) => ({ ...s, city: e.target.value }))
                }
              >
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <span>
              {built >= 12
                ? "Neighbourhood builder 🏆"
                : built >= 6
                  ? "Local enterprise 🌟"
                  : "New founder 🌱"}
            </span>
          </div>
          <CityMap state={state} slot={slot} onSlot={setSlot} />
          <div className={styles.event}>
            <span>THIS WEEK · SIMULATED MARKET</span>
            <h2>{event.title}</h2>
            <p>{event.text}</p>
          </div>
          <details className={styles.help}>
            <summary>How to play</summary>
            <ol>
              <li>
                Select a plot and open a business with your ₦500,000 starting
                budget.
              </li>
              <li>
                Advance one week to collect revenue and pay operating costs.
              </li>
              <li>
                Upgrade to level 3, invest in digital discovery or add solar
                resilience.
              </li>
              <li>
                Keep reserves, repay loans and fill all 12 plots. The simulation
                runs for 260 weeks.
              </li>
            </ol>
            <p>
              All money, costs and market events are fictional. No real
              investments, shares, prizes or withdrawals. Guest progress is
              stored on this browser; account saves are private to you. This is
              a neighbourhood simulation, not a financial forecast.
            </p>
          </details>
        </section>
        <aside className={styles.controls}>
          <section>
            <p className={styles.kicker}>YOUR NEXT MOVE</p>
            <h2>
              Plot {slot + 1}
              {plot ? " · Level " + plot.level : ""}
            </h2>
            {plot ? (
              <>
                <p>{ventures.find((v) => v.id === plot.kind)!.name}</p>
                <button
                  disabled={
                    !ready ||
                    plot.level >= 3 ||
                    state.cash <
                      ventures.find((v) => v.id === plot.kind)!.cost *
                        plot.level
                  }
                  onClick={() =>
                    setState((s) => gameAction(s, { type: "upgrade", slot }))
                  }
                >
                  {plot.level >= 3
                    ? "Maximum level reached"
                    : `Upgrade · ${money(ventures.find((v) => v.id === plot.kind)!.cost * plot.level)}`}
                </button>
              </>
            ) : (
              <>
                <label>
                  Choose your venture
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as VentureId)}
                  >
                    {ventures.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.icon} {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Open for <strong>{money(chosen.cost)}</strong>
                </p>
                <p className={styles.muted}>
                  Base revenue {money(chosen.income)} · weekly costs{" "}
                  {money(chosen.expense)}
                </p>
                <button
                  disabled={!ready || state.cash < chosen.cost}
                  onClick={() =>
                    setState((s) =>
                      gameAction(s, { type: "build", slot, kind }),
                    )
                  }
                >
                  Open business
                </button>
              </>
            )}
            <button
              className={styles.primary}
              disabled={!ready || state.week >= 260}
              onClick={() => setState((s) => gameAction(s, { type: "week" }))}
            >
              {state.week >= 260
                ? "260 weeks completed 🏆"
                : "Advance one week →"}
            </button>
          </section>
          <section>
            <h2>Build resilience</h2>
            <button
              disabled={!ready || state.digital || state.cash < 75000}
              onClick={() =>
                setState((s) => gameAction(s, { type: "digital" }))
              }
            >
              {state.digital
                ? "✓ Digital presence active"
                : "Go digital · ₦75,000"}
            </button>
            <p className={styles.muted}>
              Website + email + customer discovery. Adds 20% to game revenue.
            </p>
            <button
              disabled={!ready || state.solar || state.cash < 130000}
              onClick={() => setState((s) => gameAction(s, { type: "solar" }))}
            >
              {state.solar
                ? "✓ Solar resilience active"
                : "Solar resilience · ₦130,000"}
            </button>
            <p className={styles.muted}>
              Protect your operations from simulated power-cost shocks.
            </p>
            <button
              disabled={!ready || (state.debt > 0 && state.cash < state.debt)}
              onClick={() =>
                setState((s) =>
                  gameAction(s, { type: state.debt ? "repay" : "loan" }),
                )
              }
            >
              {state.debt
                ? "Repay ₦200,000 loan"
                : "Borrow ₦200,000 play money"}
            </button>
            <p className={styles.muted}>
              1.5% weekly interest until the full loan is repaid.
            </p>
          </section>
          <section>
            <h2>Your progress</h2>
            <p role="status">{status}</p>
            {signedIn ? (
              <button disabled={busy || !ready} onClick={save}>
                {busy ? "Saving…" : "Save to my JKTL account"}
              </button>
            ) : (
              <Link href="/login?next=tycoon">Connect your JKTL account →</Link>
            )}
            <button
              className={styles.reset}
              disabled={!ready}
              onClick={() => setRestart(true)}
            >
              Start a new neighbourhood
            </button>
            {restart && (
              <div>
                <p>
                  Replace this game with a new neighbourhood? Your account save
                  changes only when you save.
                </p>
                <button
                  onClick={() => {
                    setState(newGame(state.city));
                    setRestart(false);
                  }}
                >
                  Yes, restart
                </button>
                <button onClick={() => setRestart(false)}>Keep playing</button>
              </div>
            )}
          </section>
        </aside>
      </div>
      <section className={styles.journal}>
        <h2>Your founder journal</h2>
        <ul>
          {state.log.map((entry, i) => (
            <li key={`${state.week}-${i}`}>{entry}</li>
          ))}
        </ul>
      </section>
      <footer className={styles.footer}>
        <p>Ready to build beyond the game?</p>
        <a href="https://jktl.com.ng/pricing">Explore JKTL Business</a>
        <span>
          Independent fictional game. No affiliation with Dangote or any
          securities issuer.
        </span>
      </footer>
    </main>
  );
}
