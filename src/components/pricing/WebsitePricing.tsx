"use client";
import { useLanguage, T } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Check,
  ArrowRight,
  Globe,
  ShieldCheck,
  LayoutTemplate,
} from "lucide-react";
import {
  WEBSITE_PLANS,
  websitePlanQuote,
  priceNGN,
  type WebsiteBillingInterval,
  type PlanId,
} from "@/lib/website-pricing";
import styles from "./WebsitePricing.module.css";
export function WebsitePricing({
  insideBusiness = false,
  onSelectPlan,
  selectedPlanId,
  afterFoundation,
  startHref,
  startLabel,
}: {
  insideBusiness?: boolean;
  afterFoundation?: ReactNode;
  startHref?: string;
  startLabel?: string;
  selectedPlanId?: PlanId;
  onSelectPlan?: (planId: PlanId, interval: WebsiteBillingInterval) => void;
}) {
  const { t } = useLanguage();
  const [interval, setInterval] = useState<WebsiteBillingInterval>("yearly");
  const [compare, setCompare] = useState(false);
  return (
    <div className={styles.pricing}>
      <section className={styles.hero}>
        <p
          style={{
            marginBottom: 28,
            padding: "10px 16px",
            borderRadius: 14,
            background: "#E2CF96",
            fontSize: 13,
          }}
        >
          <T>14-day money-back guarantee on your first paid website plan ·</T>{" "}
          <Link
            href="https://jktl.com.ng/terms#website-guarantee"
            style={{ textDecoration: "underline" }}
          >
            <T>Terms apply</T>
          </Link>
        </p>
        <p className={styles.eyebrow}>
          <T>JKTL BUSINESS · PLANS & PRICING</T>
        </p>
        <h1>
          <T>Find the right plan</T>
          <br />
          <T>for your next chapter.</T>
        </h1>
        <p>
          <T>
            Create your site for free. Choose more capabilities as your business
            grows.
          </T>
        </p>
        <Link
          className={styles.primary}
          href={
            startHref ||
            (insideBusiness
              ? "/business/templates"
              : "https://business.jktl.com.ng/signup")
          }
        >
          <T>{startLabel || "Start for free"}</T> <ArrowRight size={18} />
        </Link>
        <div className={styles.included}>
          <span>
            <Globe size={18} />
            <T>Free JKTL subdomain</T>
          </span>
          <span>
            <ShieldCheck size={18} />
            <T>Managed hosting & SSL</T>
          </span>
          <span>
            <LayoutTemplate size={18} />
            <T>200 designs + blank canvases</T>
          </span>
        </div>
        <div
          className={styles.toggle}
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            aria-pressed={interval === "yearly"}
            onClick={() => {
              setInterval("yearly");
              if (selectedPlanId) onSelectPlan?.(selectedPlanId, "yearly");
            }}
          >
            <T>Yearly </T>
            <span>
              <T>Best value</T>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={interval === "monthly"}
            onClick={() => {
              setInterval("monthly");
              if (selectedPlanId) onSelectPlan?.(selectedPlanId, "monthly");
            }}
          >
            <T>Monthly</T>
          </button>
        </div>
        <p className={styles.small}>
          <T>Save with yearly billing. All prices in NGN.</T>
        </p>
        <div className={styles.grid}>
          {WEBSITE_PLANS.map((plan) => {
            const quote = websitePlanQuote(plan.id, interval);
            return (
              <article
                key={plan.id}
                className={`${styles.card} ${plan.id === "growth" ? styles.recommended : ""}`}
              >
                <span className={styles.badge}>
                  {plan.id === "growth"
                    ? "RECOMMENDED"
                    : plan.id === "free"
                      ? "NO CREDIT CARD REQUIRED"
                      : ""}
                </span>
                <h2>
                  <T>{plan.name}</T>
                </h2>
                <p className={styles.description}>
                  <T>{plan.description}</T>
                </p>
                <p className={styles.price}>
                  {priceNGN(quote.monthlyEquivalentKobo)}
                  <small>
                    <T>/mo</T>
                  </small>
                </p>
                <p className={styles.billing}>
                  {plan.id === "free"
                    ? "Free to start — no subscription charge"
                    : interval === "yearly"
                      ? `${priceNGN(quote.amountKobo)} ${t("billed yearly")}`
                      : `${priceNGN(quote.amountKobo)} ${t("billed monthly")}`}
                </p>
                <p className={styles.savings}>
                  {quote.savingsKobo
                    ? `Save ${priceNGN(quote.savingsKobo)} per year`
                    : plan.id === "free"
                      ? "Start with your free website"
                      : "Monthly billing available"}
                </p>
                {onSelectPlan && (
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      margin: "8px 0 24px",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="website-plan"
                      value={plan.id}
                      checked={selectedPlanId === plan.id}
                      onChange={() => onSelectPlan(plan.id, interval)}
                    />{" "}
                    <T>Select </T>
                    {plan.name}
                  </label>
                )}
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} />
                      <span>
                        <T>{feature}</T>
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className={styles.notice}>
          <strong>
            <T>14-day money-back guarantee.</T>
          </strong>
          <T>
            Your first website-plan payment is covered. Request a refund in JKTL
            Business within 14 days.
          </T>{" "}
          <Link href="https://jktl.com.ng/terms#website-guarantee">
            <T>Read the terms</T>
          </Link>
          <T>
            . Features marked ¹ are coming later; your payment activates the
            current capabilities shown at checkout. Existing customers retain
            their current tools and subscriptions.
          </T>
        </p>
        <Link
          className={styles.primary}
          href={
            startHref ||
            (insideBusiness
              ? "/business/templates"
              : "https://business.jktl.com.ng/signup")
          }
        >
          <T>{startLabel || "Start for free"}</T> <ArrowRight size={18} />
        </Link>
        <button
          type="button"
          className={styles.outline}
          aria-expanded={compare}
          aria-controls="plan-comparison"
          onClick={() => setCompare(!compare)}
        >
          {compare ? "Hide" : "Compare"}
          <T>Plan Features</T>
        </button>
        {compare && (
          <div id="plan-comparison" className={styles.table}>
            <table>
              <caption>
                <T>Website plan allowances — current access preserved</T>
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    <T>Capability</T>
                  </th>
                  {WEBSITE_PLANS.map((p) => (
                    <th scope="col" key={p.id}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Templates",
                    "200 + blanks",
                    "200 + blanks",
                    "200 + blanks",
                    "200 + blanks",
                    "200 + blanks",
                  ],
                  ["Published websites", "1", "1", "1", "1", "1"],
                  ["Collaborators", "1", "2", "5", "10", "25"],
                  [
                    "Hosting & SSL",
                    "Included",
                    "Included",
                    "Included",
                    "Included",
                    "Included",
                  ],
                  [
                    "Custom domain connection",
                    "Upgrade",
                    "Included",
                    "Included",
                    "Included",
                    "Included",
                  ],
                  [
                    "AI products¹",
                    "Add-on quote",
                    "Add-on quote",
                    "Add-on quote",
                    "Limited chatbot",
                    "Higher limits",
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) =>
                      i === 0 ? (
                        <th scope="row" key={i}>
                          {cell}
                        </th>
                      ) : (
                        <td key={i}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.small}>
          <T>
            Annual monthly equivalents are rounded to the nearest naira. Annual
            totals are exact. Domain registration, business email, optional
            add-ons and any applicable taxes are confirmed separately before
            payment. No charge is made by selecting a plan.
          </T>
        </p>
      </section>
      <section className={styles.foundation}>
        <h2>
          <T>A strong foundation</T>
          <br />
          <T>for your business online.</T>
        </h2>
        <div className={styles.foundationGrid}>
          <article>
            <h3>
              <T>A website that feels like you</T>
            </h3>
            <p>
              <T>
                Explore 200 industry designs and two blank canvases. Preview on
                desktop or mobile before you choose.
              </T>
            </p>
            <Link href={insideBusiness ? "/business/templates" : "/templates"}>
              <T>Explore Templates →</T>
            </Link>
          </article>
          <article>
            <h3>
              <T>Your digital essentials</T>
            </h3>
            <p>
              <T>
                Keep your domain, hosting and business email clear and separate.
                Hosting for your JKTL website is already included.
              </T>
            </p>
            <Link href="https://jktl.com.ng/products/domains">
              <T>Domains & Hosting →</T>
            </Link>
          </article>
          <article>
            <h3>
              <T>Tools for the everyday</T>
            </h3>
            <p>
              <T>
                Keep customers, invoices, appointments, inventory and expenses
                together, with additional capabilities as you grow.
              </T>
            </p>
            <Link href="https://jktl.com.ng/products/business-tools">
              <T>Explore Business Tools →</T>
            </Link>
          </article>
        </div>
      </section>
      {afterFoundation}
      <section className={styles.faq}>
        <h2>
          <T>Before you choose</T>
        </h2>
        {[
          [
            "Can I start for free?",
            "Yes. Choose a template or blank canvas, create an account and publish one website on a free JKTL subdomain. No credit card is required.",
          ],
          [
            "Can I pay monthly?",
            "Yes. The toggle shows monthly prices alongside yearly totals and genuine savings against 12 monthly payments.",
          ],
          [
            "Do I need to buy hosting again?",
            "No. Managed hosting is included for your published JKTL website. Standalone hosting, domain registration and email are quoted separately.",
          ],
          [
            "Will my existing subscription change?",
            "Your existing contract, tools and access remain intact. Any plan or billing changes will be confirmed with you first.",
          ],
          [
            "Can I cancel or change plans?",
            "Existing paid subscriptions retain their current management and cancellation controls in Settings. Choose and pay for website plans in JKTL Business. You can stop renewal or schedule a different plan for the end of your paid period; a new paid plan requires your confirmation before checkout.",
          ],
          [
            "Is AI usage unlimited?",
            "No. Your AI product quote confirms the included allowance, usage charges and spending controls before activation.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
