"use client";
import { useState } from "react";
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
}: {
  insideBusiness?: boolean;
  selectedPlanId?: PlanId;
  onSelectPlan?: (planId: PlanId, interval: WebsiteBillingInterval) => void;
}) {
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
            background: "#d5e5c4",
            fontSize: 13,
          }}
        >
          14-day money-back guarantee on your first paid website plan ·{" "}
          <a
            href="https://jktl.com.ng/terms#website-guarantee"
            style={{ textDecoration: "underline" }}
          >
            Terms apply
          </a>
        </p>
        <p className={styles.eyebrow}>JKTL BUSINESS · PLANS & PRICING</p>
        <h1>
          Find the right plan
          <br />
          for your next chapter.
        </h1>
        <p>
          Create your site for free. Choose more capabilities as your business
          grows.
        </p>
        <a
          className={styles.primary}
          href={
            insideBusiness
              ? "/business/templates"
              : "https://business.jktl.com.ng/signup"
          }
        >
          Start for Free <ArrowRight size={18} />
        </a>
        <div className={styles.included}>
          <span>
            <Globe size={18} /> Free JKTL subdomain
          </span>
          <span>
            <ShieldCheck size={18} /> Managed hosting & SSL
          </span>
          <span>
            <LayoutTemplate size={18} /> 200 designs + blank canvases
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
            Yearly <span>Best value</span>
          </button>
          <button
            type="button"
            aria-pressed={interval === "monthly"}
            onClick={() => {
              setInterval("monthly");
              if (selectedPlanId) onSelectPlan?.(selectedPlanId, "monthly");
            }}
          >
            Monthly
          </button>
        </div>
        <p className={styles.small}>
          Save with yearly billing. All prices in NGN.
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
                <h2>{plan.name}</h2>
                <p className={styles.description}>{plan.description}</p>
                <p className={styles.price}>
                  {priceNGN(quote.monthlyEquivalentKobo)}
                  <small>/mo</small>
                </p>
                <p className={styles.billing}>
                  {plan.id === "free"
                    ? "Free to start — no subscription charge"
                    : interval === "yearly"
                      ? `${priceNGN(quote.amountKobo)} billed yearly`
                      : `${priceNGN(quote.amountKobo)} billed monthly`}
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
                    Select {plan.name}
                  </label>
                )}
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className={styles.notice}>
          <strong>14-day money-back guarantee.</strong> Your first website-plan
          payment is covered. Request a refund in JKTL Business within 14 days.{" "}
          <a href="https://jktl.com.ng/terms#website-guarantee">
            Read the terms
          </a>
          . Features marked ¹ are coming later; your payment activates the
          current capabilities shown at checkout. Existing customers retain
          their current tools and subscriptions.
        </p>
        <a
          className={styles.primary}
          href={
            insideBusiness
              ? "/business/templates"
              : "https://business.jktl.com.ng/signup"
          }
        >
          Start for free <ArrowRight size={18} />
        </a>
        <button
          type="button"
          className={styles.outline}
          aria-expanded={compare}
          aria-controls="plan-comparison"
          onClick={() => setCompare(!compare)}
        >
          {compare ? "Hide" : "Compare"} Plan Features
        </button>
        {compare && (
          <div id="plan-comparison" className={styles.table}>
            <table>
              <caption>
                Website plan allowances — current access preserved
              </caption>
              <thead>
                <tr>
                  <th scope="col">Capability</th>
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
          Annual monthly equivalents are rounded to the nearest naira. Annual
          totals are exact. Domain registration, business email, optional
          add-ons and any applicable taxes are confirmed separately before
          payment. No charge is made by selecting a plan.
        </p>
      </section>
      <section className={styles.foundation}>
        <h2>
          A strong foundation
          <br />
          for your business online.
        </h2>
        <div className={styles.foundationGrid}>
          <article>
            <h3>A website that feels like you</h3>
            <p>
              Explore 200 industry designs and two blank canvases. Preview on
              desktop or mobile before you choose.
            </p>
            <a href={insideBusiness ? "/business/templates" : "/templates"}>
              Explore Templates →
            </a>
          </article>
          <article>
            <h3>Your digital essentials</h3>
            <p>
              Keep your domain, hosting and business email clear and separate.
              Hosting for your JKTL website is already included.
            </p>
            <a href="https://jktl.com.ng/products/domains">
              Domains & Hosting →
            </a>
          </article>
          <article>
            <h3>Tools for the everyday</h3>
            <p>
              Keep customers, invoices, appointments, inventory and expenses
              together, with additional capabilities as you grow.
            </p>
            <a href="https://jktl.com.ng/products/business-tools">
              Explore Business Tools →
            </a>
          </article>
        </div>
      </section>
      <section className={styles.faq}>
        <h2>Before you choose</h2>
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
