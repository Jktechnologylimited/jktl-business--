"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import {
  isLanguage,
  languageNames,
  supportedLanguages,
  translate,
  type Language,
} from "@/lib/languages";
import styles from "./LanguageProvider.module.css";
const cookieName = "jktl_language";
function snapshot(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const value = document.cookie
      .split("; ")
      .find((item) => item.startsWith(cookieName + "="))
      ?.split("=")[1];
    if (isLanguage(value)) return value;
    const stored = window.localStorage.getItem(cookieName);
    return isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("jktl-language-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("jktl-language-change", callback);
    window.removeEventListener("storage", callback);
  };
}
function setLanguage(language: Language) {
  if (!isLanguage(language)) return;
  const host = window.location.hostname;
  const shared = host === "jktl.com.ng" || host.endsWith(".jktl.com.ng");
  document.cookie = `${cookieName}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${shared ? "; Domain=.jktl.com.ng; Secure" : ""}`;
  try {
    window.localStorage.setItem(cookieName, language);
  } catch {}
  window.dispatchEvent(new Event("jktl-language-change"));
}
const Context = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
  t: (value: string) => string;
}>({ language: "en", setLanguage: () => {}, t: (value) => value });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "en" as Language,
  );
  const path = usePathname();
  useEffect(() => {
    const example =
      /^\/(sites|template-canvas)(\/|$)/.test(path) ||
      /^\/templates\/[^/]+/.test(path);
    document.documentElement.lang = example ? "en" : language;
  }, [language, path]);
  return (
    <Context.Provider
      value={{
        language,
        setLanguage,
        t: (value) => translate(language, value),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLanguage() {
  return useContext(Context);
}
export function T({ children }: { children: string }) {
  const { t } = useLanguage();
  return <>{t(children)}</>;
}
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <label className={styles.switcher}>
      <Globe size={15} aria-hidden="true" />
      <span className={styles.srOnly}>Language / Harshe / Asụsụ / Èdè</span>
      <select
        aria-label="Language / Harshe / Asụsụ / Èdè"
        value={language}
        onChange={(event) => {
          if (isLanguage(event.target.value)) setLanguage(event.target.value);
        }}
      >
        {supportedLanguages.map((code) => (
          <option key={code} value={code} lang={code}>
            {languageNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
