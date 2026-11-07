"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Play,
  Search,
  Shuffle,
  Star,
} from "lucide-react";
import { GAMES } from "@/lib/game-catalog";
import styles from "./Games.module.css";
const categories = [
  "All",
  "Arcade",
  "Words",
  "Puzzles",
  "Adventure",
  "Business",
  "Favourites",
];
function randomIndex(length: number) {
  return Math.floor(Math.random() * length);
}
function stored(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (id): id is string =>
              typeof id === "string" && GAMES.some((g) => g.id === id),
          )
          .slice(0, 9)
      : [];
  } catch {
    return [];
  }
}
function save(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function GameHub({
  business,
  fantasy,
}: {
  business: string;
  fantasy: string;
}) {
  const [active, setActive] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [favourites, setFavourites] = useState<string[]>([]),
    [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    const read = () => {
      const id = new URL(window.location.href).searchParams.get("game");
      setActive(GAMES.some((g) => g.id === id) ? id : null);
    };
    const timer = setTimeout(() => {
      setFavourites(stored("jktl-game-favourites"));
      setRecent(stored("jktl-game-recent"));
      read();
    }, 0);
    window.addEventListener("popstate", read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", read);
    };
  }, []);
  function open(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("game", id);
    window.history.pushState({}, "", url);
    setActive(id);
    const next = [id, ...recent.filter((value) => value !== id)].slice(0, 6);
    setRecent(next);
    save("jktl-game-recent", next);
  }
  function back() {
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    window.history.pushState({}, "", url);
    setActive(null);
  }
  function favourite(id: string) {
    const next = favourites.includes(id)
      ? favourites.filter((value) => value !== id)
      : [...favourites, id];
    setFavourites(next);
    save("jktl-game-favourites", next);
  }
  const game = GAMES.find((g) => g.id === active);
  if (game) {
    const source =
      game.id === "fantasy" ? fantasy : `${business}${game.href}?return=games`;
    return (
      <main className={styles.hub}>
        <header className={styles.bar}>
          <button className={styles.back} onClick={back}>
            <ArrowLeft size={18} /> All games
          </button>
          <h1>{game.name}</h1>
          <a
            className={styles.full}
            href={source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Full screen <ArrowUpRight size={13} aria-hidden="true" />
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
  const filtered = GAMES.filter(
    (g) =>
      (category === "All" ||
        (category === "Favourites"
          ? favourites.includes(g.id)
          : g.category === category)) &&
      `${g.name} ${g.description} ${g.category}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const searching = query.trim() !== "" || category !== "All";
  const groups = searching
    ? [
        {
          title:
            category === "Favourites"
              ? "Your favourites"
              : "Find your next game",
          games: filtered,
        },
      ]
    : [
        { title: "Fresh picks", games: GAMES.filter((g) => g.fresh) },
        ...(recent.length
          ? [
              {
                title: "Jump back in",
                games: recent.map((id) => GAMES.find((g) => g.id === id)!),
              },
            ]
          : []),
        {
          title: "Words & puzzles",
          games: GAMES.filter((g) => ["Words", "Puzzles"].includes(g.category)),
        },
        {
          title: "Arcade & adventure",
          games: GAMES.filter((g) =>
            ["Arcade", "Adventure"].includes(g.category),
          ),
        },
        {
          title: "Build & trade",
          games: GAMES.filter((g) => g.category === "Business"),
        },
      ];
  return (
    <main className={styles.catalogue}>
      <header className={styles.catalogueTop}>
        <a
          href="https://jktl.com.ng"
          className={styles.brand}
          aria-label="JKTL main site"
        >
          JKTL<span>PLAY</span>
        </a>
        <a href="https://business.jktl.com.ng">
          JKTL Business <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      </header>
      <div className={styles.catalogueIntro}>
        <div>
          <p className={styles.eyebrow}>A LITTLE PLAY. A LOT OF POSSIBILITY.</p>
          <h1>Your next little obsession.</h1>
          <p>
            Nigerian stories. Quick challenges. Big imagination. Pick a game and
            jump straight in.
          </p>
        </div>
        <button
          className={styles.pick}
          onClick={() => {
            const choices = filtered.length ? filtered : GAMES;
            open(choices[randomIndex(choices.length)].id);
          }}
        >
          <Shuffle size={20} /> Pick for me
        </button>
      </div>
      <div className={styles.filterBar}>
        <label className={styles.search}>
          <Search size={18} />
          <input
            type="search"
            aria-label="Search games"
            placeholder="Find your kind of fun…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <nav className={styles.categories} aria-label="Game categories">
          {categories.map((value) => (
            <button
              key={value}
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {value}
            </button>
          ))}
        </nav>
      </div>
      <nav aria-label="Choose a game" className={styles.collections}>
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <div className={styles.cardGrid}>
              {group.games.map((g) => (
                <article className={styles.gameCard} key={g.id}>
                  <a
                    href={g.href}
                    aria-label={g.name}
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      open(g.id);
                    }}
                  >
                    <div className={styles.cover}>
                      <Image
                        src={g.cover}
                        alt=""
                        width={320}
                        height={420}
                        sizes="(max-width: 600px) 45vw, 220px"
                      />
                      {g.fresh && <span className={styles.newBadge}>NEW</span>}
                      <span className={styles.playBadge}>
                        Play now <Play size={10} aria-hidden="true" />
                      </span>
                    </div>
                    <h3>{g.name}</h3>
                    <p>{g.description}</p>
                  </a>
                  <button
                    className={styles.favourite}
                    aria-label={`${favourites.includes(g.id) ? "Remove" : "Save"} ${g.name} ${favourites.includes(g.id) ? "from" : "to"} favourites`}
                    aria-pressed={favourites.includes(g.id)}
                    onClick={() => favourite(g.id)}
                  >
                    <Star
                      size={18}
                      fill={favourites.includes(g.id) ? "currentColor" : "none"}
                    />
                  </button>
                </article>
              ))}
            </div>
            {!group.games.length && (
              <p className={styles.empty}>
                No games here yet. Try another search or save a favourite using
                the star on a game.
              </p>
            )}
          </section>
        ))}
      </nav>
      <footer className={styles.catalogueFooter}>
        Free to try · No account required · Casual scores stay on your device.
        <br />
        <a href="https://jktl.com.ng">Made by JK Technology Limited</a>
      </footer>
    </main>
  );
}
