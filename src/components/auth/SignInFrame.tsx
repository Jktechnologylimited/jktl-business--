import { ThemeControl } from "@/components/settings/theme-control";
import type { ReactNode } from "react";
import styles from "./SignInFrame.module.css";
export function SignInFrame({
  children,
  kind = "business",
}: {
  children: ReactNode;
  kind?: "business" | "admin" | "affiliate";
}) {
  const copy = {
    business: [
      "Your next chapter starts here.",
      "Websites, customers and everyday business. One place to bring it all together.",
    ],
    admin: [
      "A clear view. A stronger business.",
      "The JKTL team workspace. Built for the people keeping everything moving.",
    ],
    affiliate: [
      "Trusted voices. Shared growth.",
      "Introduce ambitious business owners to JKTL, and grow alongside them.",
    ],
  }[kind];
  return (
    <main className={styles.frame}>
      <aside className={styles.story}>
        <a href="https://jktl.com.ng" className={styles.brand}>
          JKTL<span>BUSINESS</span>
        </a>
        <div className={styles.copy}>
          <p>BUILT FOR AMBITION · ROOTED IN NIGERIA</p>
          <h2>{copy[0]}</h2>
          <p>{copy[1]}</p>
        </div>
        <div
          className={styles.photo}
          role="img"
          aria-label="Smiling African entrepreneur working with her team"
        />
        <div className={styles.caption}>Good ideas deserve room to grow.</div>
      </aside>
      <section className={styles.panel}>
        <div className={styles.theme}>
          <ThemeControl />
        </div>
        {children}
      </section>
    </main>
  );
}
