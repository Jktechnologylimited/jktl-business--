"use client";
import { useEffect, useRef, useState, useId } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import styles from "./theme-control.module.css";
import { useThemePreference, setThemePreference } from "@/lib/theme";
export function ThemeControl({
  align = "end",
}: { align?: "start" | "end" } = {}) {
  const theme = useThemePreference();
  const optionsId = useId();
  const [position, setPosition] = useState({ left: 8, top: 46 });
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <div
      data-theme-control
      className={styles.root}
      ref={root}
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={`Color theme: ${theme}`}
        aria-expanded={open}
        aria-controls={optionsId}
        onClick={() => {
          const box = trigger.current?.getBoundingClientRect();
          if (box)
            setPosition({
              left: Math.max(
                8,
                Math.min(
                  innerWidth - 198,
                  align === "start" ? box.left : box.right - 190,
                ),
              ),
              top: box.bottom + 10,
            });
          setOpen(!open);
        }}
      >
        <Icon size={17} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={optionsId}
          style={position}
          data-align={align}
          className={styles.options}
          role="group"
          aria-label="Color theme"
        >
          {(["light", "dark", "system"] as const).map((choice) => {
            const OptionIcon =
              choice === "light" ? Sun : choice === "dark" ? Moon : Monitor;
            return (
              <button
                type="button"
                key={choice}
                aria-pressed={theme === choice}
                onClick={() => {
                  setThemePreference(choice);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <OptionIcon size={16} aria-hidden="true" />
                {choice === "system"
                  ? "Use device setting"
                  : choice === "dark"
                    ? "Dark"
                    : "Light"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
