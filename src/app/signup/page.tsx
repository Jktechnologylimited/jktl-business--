"use client";
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
  const signIn = selected ? `/login?template=${selected.id}` : "/login";
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
    router.push(next ? `/onboarding?template=${next}` : "/onboarding");
  }
  return (
    <div className={`jktl-light ${styles.page}`}>
      <header className={styles.topbar}>
        <a href="https://jktl.com.ng" className={styles.brand}>
          <Image src="/jktl-logo.png" alt="" width={38} height={38} priority />
          JKTL Business
        </a>
        <p className={styles.signin}>
          <span>Already have an account?</span>
          <Link href={signIn}>Log in</Link>
        </p>
      </header>
      <main className={styles.layout}>
        <section className={styles.story} aria-label="Build with JKTL">
          <p className={styles.eyebrow}>A place for your next big idea</p>
          <h2>
            Your business.
            <br />
            Your vision.
            <br />
            Your next chapter.
          </h2>
          <p>
            Bring your business online with a website that feels like you—and
            the tools to help it grow.
          </p>
          <div className={styles.benefits}>
            <span>
              <Globe size={12} />
              Website builder
            </span>
            <span>
              <Layers size={12} />
              200 designs
            </span>
            <span>
              <BriefcaseBusiness size={12} />
              Business tools
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
                  Your brand.<span>HOME · ABOUT · CONTACT</span>
                </p>
                <h3>
                  Make room for
                  <br />
                  what comes next.
                </h3>
                <p>
                  A little inspiration. A fresh perspective. A space that is
                  entirely yours.
                </p>
                <span className={styles.sampleButton}>
                  Explore the possibilities
                </span>
                <div className={styles.art} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
            <p className={styles.caption}>
              Built around your business.
              <span>Start with a template. Make it your own.</span>
            </p>
          </div>
        </section>
        <section className={styles.card} aria-labelledby="signup-heading">
          <p className={styles.eyebrow}>Let’s get you started</p>
          <h1 id="signup-heading">Create your free account</h1>
          <p className={styles.subhead}>
            Your next chapter starts here.
            <br />
            Start for free. No credit card required.
          </p>
          {selected && (
            <div className={styles.selected}>
              <CheckCircle2 size={21} />
              <div>
                <strong>Selected template: {selected.name}</strong>
                <p>
                  Your selected template is ready. It will open after account
                  setup.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.names}>
              <label className={styles.field} htmlFor="name">
                <span>Your name</span>
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
                <span>Business name</span>
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
              <span>Email address</span>
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
                Password
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
                Use at least 6 characters.
              </p>
            </div>
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending ? "Opening your workspace…" : "Get started free"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
          <p className={styles.agreement}>
            * By signing up, you agree to our{" "}
            <a
              href="https://jktl.com.ng/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Use
            </a>{" "}
            and acknowledge you’ve read our{" "}
            <a
              href="https://jktl.com.ng/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
          <p className={styles.reassurance}>
            <LockKeyhole size={12} aria-hidden="true" /> No credit card required
            to get started
          </p>
          <p className={styles.bottom}>
            Already part of JKTL? <Link href={signIn}>Sign in</Link>
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} JK Technology Limited. Built for your next
        chapter.
      </footer>
    </div>
  );
}
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-[#f8f7f2] text-[#163a2c]">
          Loading your workspace…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
