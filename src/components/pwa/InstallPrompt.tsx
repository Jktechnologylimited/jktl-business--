"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Smartphone, X } from "lucide-react";
import { AddToHomeScreenGuide } from "@/components/help/add-to-home-screen-guide";
import styles from "./InstallPrompt.module.css";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const KEY = "jktl-pwa-remind-after";
function platformHost() {
  const host = location.hostname;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return (
    [
      root,
      `www.${root}`,
      `business.${root}`,
      `app.${root}`,
      "localhost",
      "127.0.0.1",
    ].includes(host) || host.endsWith(".vercel.app")
  );
}
export function InstallPrompt() {
  const path = usePathname();
  const modal = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const shown = useRef(false);
  const eligible =
    path !== "/play/run" &&
    !/^\/(admin|affiliates|affiliate|sites|template-canvas)(\/|$)/.test(path) &&
    !/^\/templates\//.test(path);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      if (!platformHost()) return;
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const installed = () => {
      setOpen(false);
      setDeferred(null);
      try {
        localStorage.setItem(KEY, String(Date.now() + 365 * 86400000));
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    if (!eligible || shown.current || !platformHost() || window.self !== window.top) return;
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    try {
      if (Number(localStorage.getItem(KEY) || 0) > Date.now()) return;
    } catch {}
    const timer = setTimeout(() => {
      shown.current = true;
      setOpen(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, [eligible]);
  useEffect(() => {
    const d = modal.current;
    if (open && eligible) {
      if (!d?.open) d?.showModal();
    } else if (d?.open) d.close();
  }, [open, eligible]);
  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now() + 7 * 86400000));
    } catch {}
    setOpen(false);
  }
  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const result = await deferred.userChoice;
      setDeferred(null);
      if (result.outcome === "accepted") {
        setOpen(false);
        try {
          localStorage.setItem(KEY, String(Date.now() + 365 * 86400000));
        } catch {}
      } else setMessage("You can install later using your browser menu.");
    } catch {
      setMessage("Use the browser steps below to add JKTL Business.");
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={modal}
      className={styles.dialog}
      aria-labelledby="pwa-title"
      aria-describedby="pwa-description"
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className={styles.inner}>
        <button
          className={styles.close}
          aria-label="Close installation guide"
          onClick={dismiss}
        >
          <X size={19} />
        </button>
        <div className={styles.icon}>
          <Smartphone size={27} />
        </div>
        <p className={styles.kicker}>YOUR BUSINESS, ONE TAP AWAY</p>
        <h2 id="pwa-title">Add JKTL Business to your home screen.</h2>
        <p id="pwa-description">
          Keep your business tools close. Open JKTL like an app, straight from
          your phone or computer.
        </p>
        {deferred && (
          <button className={styles.install} disabled={busy} onClick={install}>
            <Download size={17} />
            {busy ? "Opening installer…" : "Install JKTL Business"}
          </button>
        )}
        <div className={styles.guide}>
          <AddToHomeScreenGuide />
        </div>
        <p role="status" className={styles.note}>
          {message}
        </p>
        <button className={styles.later} onClick={dismiss}>
          Not now
        </button>
      </div>
    </dialog>
  );
}
