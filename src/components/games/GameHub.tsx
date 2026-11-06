"use client";
import { useState } from "react";
import { GAMES } from "./GameSwitcher";
import styles from "./Games.module.css";
export function GameHub({
  business,
  fantasy,
}: {
  business: string;
  fantasy: string;
}) {
  const [active, setActive] = useState("tycoon");
  const game = GAMES.find((g) => g.id === active)!;
  const source =
    active === "fantasy" ? fantasy : `${business}${game.href}?return=games`;
  return (
    <main className={styles.hub}>
      <header className={styles.bar}>
        <a className={styles.brand} href="https://jktl.com.ng" target="_top">
          JKTL
        </a>
        <h1>Games</h1>
        <nav className={styles.choices} aria-label="Choose a game">
          {GAMES.map((g) => (
            <a
              key={g.id}
              href={g.href}
              aria-current={g.id === active ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                setActive(g.id);
              }}
            >
              {g.name}
            </a>
          ))}
        </nav>
        <a className={styles.full} href={source} target="_top">
          Open game ↗
        </a>
      </header>
      <iframe
        key={active}
        title={`Play JKTL ${game.name}`}
        src={source}
        className={styles.frame}
        allow="fullscreen"
      />
    </main>
  );
}
