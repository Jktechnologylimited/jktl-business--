"use client";
import { useSyncExternalStore } from "react";
export type ThemePreference = "system" | "light" | "dark";
const key = "jktl-theme",
  event = "jktl-theme-change";
let temporaryPreference: ThemePreference | undefined;
function snapshot(): ThemePreference {
  if (temporaryPreference) return temporaryPreference;
  try {
    const saved = localStorage.getItem(key);
    return saved === "dark" || saved === "light" ? saved : "system";
  } catch {
    return "system";
  }
}
function subscribe(listener: () => void) {
  const external = (e: StorageEvent) => {
    if (e.key !== key && e.key !== null) return;
    temporaryPreference = undefined;
    apply(snapshot());
    listener();
  };
  window.addEventListener("storage", external);
  window.addEventListener(event, listener);
  return () => {
    window.removeEventListener("storage", external);
    window.removeEventListener(event, listener);
  };
}
function apply(pref: ThemePreference) {
  if (pref === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = pref;
}
export function setThemePreference(pref: ThemePreference) {
  apply(pref);
  try {
    if (pref === "system") localStorage.removeItem(key);
    else localStorage.setItem(key, pref);
    temporaryPreference = undefined;
  } catch {
    temporaryPreference = pref;
  }
  window.dispatchEvent(new Event(event));
}
export function useThemePreference() {
  return useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system" as ThemePreference,
  );
}
