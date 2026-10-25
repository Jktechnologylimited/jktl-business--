"use client";
import { ThemeControl } from "@/components/settings/theme-control";
import { emailIntent } from "@/lib/product-intent";
import { LanguageSwitcher, T } from "@/components/i18n/LanguageProvider";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Layers,
  Globe,
  BriefcaseBusiness,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getWebsiteTemplate } from "@/lib/website-templates";
import { pendingTemplate, rememberTemplate } from "@/lib/template-selection";
import { useBusinessStore } from "@/lib/store";
import styles from "./signup.module.css";
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = getWebsiteTemplate(searchParams.get("template"));
  useEffect(() => {
    if (selected) rememberTemplate(selected.id);
  }, [selected]);
  const startSignup = useBusinessStore((s) => s.startSignup);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const referralCode = searchParams.get("ref");
  const signIn = emailIntent(searchParams)
    ? `/login${emailIntent(searchParams)}`
    : selected
      ? `/login?template=${selected.id}`
      : "/login";
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    startSignup(
      name.trim(),
      email.trim(),
      password,
      businessName.trim(),
      referralCode,
    );
    const next = pendingTemplate(searchParams.get("template"));
    router.push(
      emailIntent(searchParams)
        ? `/onboarding${emailIntent(searchParams)}`
        : next
          ? `/onboarding?template=${next}`
          : "/onboarding",
    );
  }
  return (
    <div className={styles.page}>
      <header className={styles.topbar} style={{ flexWrap: "wrap", gap: 16 }}>
        <a href="https://jktl.com.ng" className={styles.brand}>
          <Image src="/jktl-logo.png" alt="" width={38} height={38} priority />
          <T>JKTL Business</T>
        </a>
        <p className={styles.signin}>
          <span>
            <T>Already have an account?</T>
          </span>
          <Link href={signIn}>
            <T>Log in</T>
          </Link>
        </p>
        <div className="ml-auto flex items-center gap-2"><ThemeControl /><LanguageSwitcher /></div>
      </header>
      <main className={styles.layout}>
        <section className={styles.story} aria-label="Build with JKTL">
          <p className={styles.eyebrow}>
            <T>A place for your next big idea</T>
          </p>
          <h2>
            <T>Your business.</T>
            <br />
            <T>Your vision.</T>
            <br />
            <T>Your next chapter.</T>
          </h2>
          <p>
            <T>
              Bring your business online with a website that feels like you—and
              the tools to help it grow.
            </T>
          </p>
          <div className={styles.benefits}>
            <span>
              <Globe size={12} />
              <T>Website builder</T>
            </span>
            <span>
              <Layers size={12} />
              <T>200 designs</T>
            </span>
            <span>
              <BriefcaseBusiness size={12} />
              <T>Business tools</T>
            </span>
          </div>
          <div className={styles.showcase} aria-label="Example website design">
            <div className={styles.window}>
              <div className={styles.browser}>
                <i />
                <i />
                <i />
              </div>
              <div className={styles.sample}>
                <p className={styles.sampleNav}>
                  <T>Your brand.</T>
                  <span>
                    <T>HOME · ABOUT · CONTACT</T>
                  </span>
                </p>
                <h3>
                  <T>Make room for</T>
                  <br />
                  <T>what comes next.</T>
                </h3>
                <p>
                  <T>
                    A little inspiration. A fresh perspective. A space that is
                    entirely yours.
                  </T>
                </p>
                <span className={styles.sampleButton}>
                  <T>Explore the possibilities</T>
                </span>
                <div className={styles.art} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
            <p className={styles.caption}>
              <T>Built around your business.</T>
              <span>
                <T>Start with a template. Make it your own.</T>
              </span>
            </p>
          </div>
        </section>
        <section className={styles.card} aria-labelledby="signup-heading">
          <p className={styles.eyebrow}>
            <T>Let’s get you started</T>
          </p>
          <h1 id="signup-heading">
            <T>Create your free account</T>
          </h1>
          <p className={styles.subhead}>
            <T>Your next chapter starts here.</T>
            <br />
            <T>Start for free. No credit card required.</T>
          </p>
          {selected && (
            <div className={styles.selected}>
              <CheckCircle2 size={21} />
              <div>
                <strong>
                  <T>Selected template: </T>
                  {selected.name}
                </strong>
                <p>
                  <T>
                    Your selected template is ready. It will open after account
                    setup.
                  </T>
                </p>
              </div>
            </div>
          )}
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.names}>
              <label className={styles.field} htmlFor="name">
                <span>
                  <T>Your name</T>
                </span>
                <Input
                  className={styles.input}
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Briggs"
                  required
                  maxLength={120}
                />
              </label>
              <label className={styles.field} htmlFor="businessName">
                <span>
                  <T>Business name</T>
                </span>
                <Input
                  className={styles.input}
                  id="businessName"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business"
                  required
                  maxLength={160}
                />
              </label>
            </div>
            <label className={styles.field} htmlFor="email">
              <span>
                <T>Email address</T>
              </span>
              <Input
                className={styles.input}
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                required
                maxLength={254}
              />
            </label>
            <div className={styles.field}>
              <label className={styles.passwordLabel} htmlFor="password">
                <T>Password</T>
              </label>
              <PasswordInput
                className={styles.input}
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={6}
                aria-describedby="password-hint"
              />
              <p id="password-hint" className={styles.passwordHint}>
                <T>Use at least 6 characters.</T>
              </p>
            </div>
            <button type="submit" className={styles.submit} disabled={pending}>
              <T>{pending ? "Opening your workspace…" : "Start for free"}</T>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
          <p className={styles.agreement}>
            <T>* By signing up, you agree to our</T>{" "}
            <a
              href="https://jktl.com.ng/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              <T>Terms of Use</T>
            </a>{" "}
            <T>and acknowledge you’ve read our</T>{" "}
            <a
              href="https://jktl.com.ng/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              <T>Privacy Policy</T>
            </a>
            .
          </p>
          <p className={styles.reassurance}>
            <LockKeyhole size={12} aria-hidden="true" />
            <T>No credit card required to get started</T>
          </p>
          <p className={styles.bottom}>
            <T>Already part of JKTL? </T>
            <Link href={signIn}>
              <T>Sign in</T>
            </Link>
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        © {new Date().getFullYear()}
        <T>JK Technology Limited. Built for your next chapter.</T>
      </footer>
    </div>
  );
}
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-[#f8f7f2] text-[#060E2A]">
          <T>Loading your workspace…</T>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
