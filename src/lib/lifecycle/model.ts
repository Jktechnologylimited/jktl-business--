export const STAGES = {
  NO_SITE: "Choose a website",
  DRAFT: "Publish the website",
  FREE_DOMAIN: "Consider a custom domain",
  CONNECT_DOMAIN: "Connect the existing domain",
  COMPLETE: "Published on a custom domain",
  MANAGED: "JKTL Custom project",
} as const;
export type LifecycleStage = keyof typeof STAGES;
export type LifecycleSettings = {
  enabled: boolean;
  first_days: number;
  second_days: number;
  human_days: number;
  gap_days: number;
};
export function lifecycleStep(
  days: number,
  settings: LifecycleSettings,
): 1 | 2 | null {
  if (
    !Number.isFinite(days) ||
    days < settings.first_days ||
    days >= settings.human_days
  )
    return null;
  return days >= settings.second_days ? 2 : 1;
}
export function lifecycleSettings(form: FormData): LifecycleSettings {
  const n = (key: string) => Number(form.get(key));
  const s = {
    enabled: form.get("enabled") === "on",
    first_days: n("first_days"),
    second_days: n("second_days"),
    human_days: n("human_days"),
    gap_days: n("gap_days"),
  };
  if (
    ![s.first_days, s.second_days, s.human_days, s.gap_days].every(
      Number.isInteger,
    ) ||
    s.first_days < 1 ||
    s.second_days <= s.first_days ||
    s.human_days <= s.second_days ||
    s.human_days > 90 ||
    s.gap_days < 1 ||
    s.gap_days > 30
  )
    throw Error(
      "Use increasing reminder days between 1 and 90, with a 1–30 day email gap.",
    );
  return s;
}
function setupMessage(
  stage: LifecycleStage,
  step: number,
  business: string,
  hasDomain: boolean,
) {
  const follow = step === 2;
  if (stage === "NO_SITE")
    return {
      subject: follow
        ? "Need a hand getting your website started?"
        : "Your free business website is ready to start",
      detail: `Hello ${business},\n\n${follow ? "I’m checking in because your account has not selected a website yet." : "You can start with a free JKTL website template and make it your own."}\n\nChoose a design, add your business name, logo, services and contact details, then preview it on phone and desktop. You can publish on a free JKTL address.\n\nReply to this email or open Help & support if you would like help choosing a template.`,
      path: "/business/templates",
      category: "service" as const,
    };
  if (stage === "DRAFT")
    return {
      subject: follow
        ? "Let’s help you finish publishing your website"
        : "Your website’s next step: review and publish",
      detail: `Hello ${business},\n\nYour selected website has not been published yet. ${follow ? "If something is holding you up, tell us where you’re stuck." : "You can keep your current template and finish at your own pace."}\n\nReplace sample text and photos, check your public contact details, save, and preview both desktop and mobile. When you are ready, publish it on your available JKTL address.\n\nYou do not need to choose a template again or buy a domain to publish your free site. Reply for help; support will only edit or publish with your permission.`,
      path: "/business/website/template",
      category: "service" as const,
    };
  if (stage === "FREE_DOMAIN" || stage === "CONNECT_DOMAIN")
    return {
      subject: hasDomain
        ? "Connect your domain to your published website"
        : "A domain of your own for your published website",
      detail: `Hello ${business},\n\nYour JKTL website is published. ${hasDomain ? "If you would like to use your existing domain, review its connection settings in your account." : "If you would like an address that matches your business name, you can explore a custom domain in JKTL Business."}\n\nYour free JKTL address remains a valid option. A domain is optional, availability and current prices appear when you search, and connecting one keeps your selected template and content in place.\n\nReply if you would like help with the next step.`,
      path: "/business/domains",
      category: hasDomain ? ("service" as const) : ("marketing" as const),
    };
  throw Error("No follow-up email is needed for this stage.");
}

export function lifecycleMessage(
  stage: LifecycleStage,
  step: number,
  business: string,
  hasDomain: boolean,
  offerSubscription = false,
) {
  const setup = setupMessage(stage, step, business, hasDomain);
  const setupLabel = {
    NO_SITE: "Choose my free website template",
    DRAFT: "Finish publishing my website",
    FREE_DOMAIN: "Find my custom domain",
    CONNECT_DOMAIN: "Connect my existing domain",
    COMPLETE: "Open my website",
    MANAGED: "Open my project",
  }[stage];
  if (offerSubscription || stage === "FREE_DOMAIN") {
    return {
      ...setup,
      subject:
        step === 2
          ? "Ready to choose a website subscription for your business?"
          : "Choose the next website plan for your business",
      detail:
        setup.detail +
        "\n\nReady for a paid website plan? Choose my website plan below to compare the current subscriptions, review what is included, and complete checkout securely in JKTL Business. Your existing template and content stay in place. Choosing a plan does not charge you; payment requires your confirmation. Your free website remains available if you are not ready to upgrade.",
      category: "marketing" as const,
      path: "/business/plans",
      actionLabel: "Choose my website plan",
      secondaryPath: setup.path,
      secondaryLabel: setupLabel,
    };
  }
  return {
    ...setup,
    actionLabel: setupLabel,
    secondaryPath: "",
    secondaryLabel: "",
  };
}
