"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Gamepad2, X } from "lucide-react";
import styles from "./Games.module.css";
import { GAMES } from "@/lib/game-catalog";
export { GAMES } from "@/lib/game-catalog";
export function GameSwitcher({
  current,
  onOpen,
}: {
  current: string;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className={styles.switcher}
      ref={root}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="jktl-games-menu"
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        <Gamepad2 size={17} /> Games{" "}
        {open ? <X size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <nav
          id="jktl-games-menu"
          className={styles.menu}
          aria-label="Switch game"
        >
          <p>YOUR NEXT PLAY</p>
          {GAMES.map((game) => (
            <Link
              key={game.id}
              href={
                game.href.startsWith("/")
                  ? "https://games.jktl.com.ng" + game.href
                  : game.href
              }
              target="_top"
              aria-current={game.id === current ? "page" : undefined}
            >
              <span aria-hidden="true">{game.icon}</span>
              <div>
                <b>{game.name}</b>
                <small>{game.description}</small>
              </div>
              {game.id === current && <em>Playing</em>}
            </Link>
          ))}
          <Link href="https://business.jktl.com.ng/signup" target="_top">Create my free website →</Link>
          <Link href="https://jktl.com.ng/tools/seo-checker" target="_top">Free SEO checker</Link>
          <Link href="https://games.jktl.com.ng" target="_top">
            All games
          </Link>
          <Link href="https://jktl.com.ng" target="_top">
            JKTL main site ↗
          </Link>
        </nav>
      )}
    </div>
  );
}
