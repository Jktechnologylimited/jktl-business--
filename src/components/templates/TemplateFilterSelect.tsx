"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./TemplateFilterSelect.module.css";

type Option = { value: string; label: string };
export function TemplateFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    items = useRef<(HTMLLIElement | null)[]>([]),
    typed = useRef({ text: "", time: 0 });
  const id = useId(),
    selected = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const position = () => {
      const button = trigger.current,
        element = root.current;
      if (!button || !element) return;
      const rect = button.getBoundingClientRect(),
        below = window.innerHeight - rect.bottom - 20,
        above = rect.top - 20;
      const upwards = below < 220 && above > below;
      const list = element.querySelector<HTMLElement>('[role="listbox"]');
      if (list) {
        const width = list.getBoundingClientRect().width;
        const left = Math.max(
          24,
          Math.min(rect.left, window.innerWidth - width - 24),
        );
        element.style.setProperty(
          "--filter-list-left",
          `${left - element.getBoundingClientRect().left}px`,
        );
      }
      element.dataset.upwards = String(upwards);
      element.style.setProperty(
        "--filter-list-height",
        `${Math.max(44, upwards ? above : below)}px`,
      );
    };
    position();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) items.current[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  function show() {
    typed.current = { text: "", time: 0 };
    setActive(selected);
    setOpen(true);
  }
  function select(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (key === "Tab") {
      setOpen(false);
      return;
    }
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (open) select(active);
      else show();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (!open) {
        show();
        if (key === "Home") setActive(0);
        if (key === "End") setActive(options.length - 1);
        return;
      }
      setActive((index) =>
        key === "Home"
          ? 0
          : key === "End"
            ? options.length - 1
            : (index + (key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length,
      );
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text =
        now - typed.current.time < 700
          ? typed.current.text + key.toLocaleLowerCase()
          : key.toLocaleLowerCase();
      typed.current = { text, time: now };
      const start = open ? active : selected;
      const matches = (prefix: string) =>
        options.findIndex((_, offset) =>
          options[(start + offset + 1) % options.length].label
            .toLocaleLowerCase()
            .startsWith(prefix),
        );
      let offset = matches(text);
      if (offset < 0 && new Set(text).size === 1)
        offset = matches(key.toLocaleLowerCase());
      if (!open) setOpen(true);
      if (offset >= 0) setActive((start + offset + 1) % options.length);
      else if (!open) setActive(selected);
    }
  }
  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-expanded={open}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={styles.trigger}
        data-open={open || undefined}
        onKeyDown={keyDown}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={id}
          role="listbox"
          aria-label={label}
          className={styles.options}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              ref={(element) => {
                items.current[index] = element;
              }}
              role="option"
              aria-selected={option.value === value}
              className={styles.option}
              data-active={index === active || undefined}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(index)}
            >
              <span>{option.label}</span>
              <Check size={15} aria-hidden="true" className={styles.check} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
