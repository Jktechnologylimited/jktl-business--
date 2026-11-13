"use client";
import { ArrowUpRight, Settings, UserRound, Menu } from "lucide-react";
import { GameIcon } from "@/components/games/GameIcon";
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
import {GameSwitcher} from "@/components/games/GameSwitcher";
import { CityScene } from "./CityScene";
export function TycoonGame({ returnTo }: { returnTo?: "main" | "games" }) {
  const loginHref =
    returnTo === "games"
      ? "/login?next=games"
      : returnTo === "main"
        ? "/login?next=games-main"
        : "/login?next=tycoon";
  const [state, setState] = useState<TycoonState>(newGame);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Loading your neighbourhood…");
  const [slot, setSlot] = useState(0);
  const [kind, setKind] = useState<VentureId>("suya");
  const [busy, setBusy] = useState(false);
  const [restart, setRestart] = useState(false);
  const [panel, setPanel] = useState("none");
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
  function returnToCityOnMobile() {
    if (
      window.matchMedia(
        "(max-width: 900px), (max-width: 1000px) and (max-height: 500px)",
      ).matches
    )
      setPanel("none");
  }
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
    <main className={styles.game} data-panel={panel}>
      <header className={styles.header}>
        <Link href="/business" target="_top">
          JKTL <span>BUSINESS TYCOON</span>
        </Link>
        <button
          type="button"
          className={styles.mobileSettings}
          aria-label="Open city controls"
          aria-expanded={panel === "scene"}
          onClick={() => setPanel(panel === "scene" ? "none" : "scene")}
        >
          <Settings size={22} aria-hidden="true" />
        </button>
        <GameSwitcher current="tycoon"/>
        <nav>
          {signedIn ? (
            <Link href="/business" target="_top">
              My dashboard
            </Link>
          ) : (
            <Link href={loginHref} target="_top">
              Sign in to save
            </Link>
          )}
        </nav>
      </header>
      <div className={styles.ticker} aria-label="Business revenue guide">
        {ventures.map((v) => (
          <span key={v.id}>
            <b>{v.name}</b> {money(v.income)} base weekly revenue
          </span>
        ))}
      </div>
      <div className={styles.founder}>
        <span aria-hidden="true"><UserRound size={24} aria-hidden="true" /></span>
        <div>
          <strong>{signedIn ? "JKTL founder" : "Guest founder"}</strong>
          <small>
            Level {1 + Math.floor(built / 3)} · {built}/12 businesses
          </small>
        </div>
      </div>
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
                ? "Neighbourhood builder"
                : built >= 6
                  ? "Local enterprise"
                  : "New founder"}
            </span>
          </div>
          <CityScene
            ready={ready}
            toolsOpen={panel === "scene"}
            onCloseTools={() => setPanel("none")}
            state={state}
            slot={slot}
            onSlot={(n) => {
              setSlot(n);
              setPanel("build");
            }}
          />
          <div className={styles.event}>
            <span>THIS WEEK · SIMULATED MARKET</span>
            <h2>{event.title}</h2>
            <p>{event.text}</p>
          </div>
          <details className={styles.help} open={panel === "help"}>
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
          <section className={styles.mobileMore}>
            <h2>Game menu</h2>
            <p>
              Level {1 + Math.floor(built / 3)} · {built}/12 businesses ·{" "}
              {state.city}
            </p>
            <label>
              Your city
              <select
                value={state.city}
                disabled={!ready}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              >
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setPanel("scene")}>
              City & graphics controls
            </button>
            <button type="button" onClick={() => setPanel("help")}>
              How to play
            </button>
            <Link href="/play/word-hunt" target="_top">Word Hunt <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" /></Link>
            <Link href="/play/run" target="_top">Street Run <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" /></Link>
            <Link href="https://games.jktl.com.ng" target="_top">All games <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" /></Link>
            <Link href="https://jktl.com.ng" target="_top">
              Main site <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
            </Link>
            <a href="https://jktl.com.ng/pricing" target="_top">
              Explore JKTL Business
            </a>
          </section>
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
                        <GameIcon name={v.icon} size={18} /> {v.name}
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
                  onClick={() => {
                    setState((s) =>
                      gameAction(s, { type: "build", slot, kind }),
                    );
                    returnToCityOnMobile();
                  }}
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
                ? "260 weeks completed"
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
                ? "Digital presence active"
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
                ? "Solar resilience active"
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
              <Link href={loginHref} target="_top">
                Connect your JKTL account →
              </Link>
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
      <nav className={styles.dock} aria-label="Game controls">
        {[
          ["build", "build", "Build & manage"],
          ["market", "trend", "Market"],
          ["journal", "journal", "Journal"],
          ["help", "help", "How to play"],
        ].map(([key, icon, label]) => (
          <button
            key={key}
            className={key === "help" ? styles.desktopOnly : undefined}
            aria-pressed={panel === key}
            onClick={() => setPanel(panel === key ? "none" : key)}
          >
            <span aria-hidden="true"><GameIcon name={icon} size={20} /></span>
            {label}
          </button>
        ))}
        <button
          type="button"
          className={styles.mobileOnly}
          aria-pressed={panel === "menu"}
          onClick={() => setPanel(panel === "menu" ? "none" : "menu")}
        >
          <span aria-hidden="true"><Menu size={22} aria-hidden="true" /></span>More
        </button>
        <button
          type="button"
          className={`${styles.mobileOnly} ${styles.nextWeek}`}
          disabled={!ready || state.week >= 260}
          onClick={() =>
            setState((current) => gameAction(current, { type: "week" }))
          }
        >
          <span aria-hidden="true">→</span>
          {state.week >= 260 ? "Complete" : "Next week"}
        </button>
      </nav>
      {panel !== "none" && panel !== "scene" && (
        <button
          className={styles.closePanel}
          aria-label="Close game panel"
          onClick={() => setPanel("none")}
        >
          ×
        </button>
      )}
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
        <a href="https://jktl.com.ng/pricing" target="_top">
          Explore JKTL Business
        </a>
        <span>
          Independent fictional game. No affiliation with Dangote or any
          securities issuer.
        </span>
      </footer>
    </main>
  );
}
