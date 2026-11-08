import { HELP_GUIDES, type HelpGuide } from "@/lib/support/knowledge";
export const TOPICS = [
  [
    "getting-started",
    "Getting started",
    "Accounts, navigation and your first website",
  ],
  [
    "websites",
    "Websites & templates",
    "Choose, edit, publish and measure your site",
  ],
  [
    "domains",
    "Domains & renewals",
    "Search, purchase, connect and keep services current",
  ],
  [
    "email",
    "Business Email & notifications",
    "Mailboxes, delivery and account messages",
  ],
  [
    "billing",
    "Plans, payments & billing",
    "Checkout, invoices, subscriptions and refunds",
  ],
  [
    "operations",
    "Daily business tools",
    "Customers, bookings, sales, inventory and reports",
  ],
  [
    "account",
    "Account, app & security",
    "Sign-in, permissions, installation and syncing",
  ],
  [
    "support",
    "Help & customer care",
    "Troubleshooting, safe assistance and escalation",
  ],
  [
    "partners",
    "JKTL Partners",
    "Client work, agreements, commissions and payouts",
  ],
  [
    "affiliates",
    "JKTL Affiliates",
    "Promotion, referrals, resources and earnings",
  ],
  [
    "custom",
    "Custom projects",
    "Existing client sites, CMS and service billing",
  ],
  ["chatbot", "AI Chatbot", "Knowledge, installation, conversations and usage"],
  [
    "games",
    "Games & resources",
    "Game accounts, public content and product discovery",
  ],
  ["team", "Team operations", "Authorized operational workflows and reporting"],
] as const;
export type Topic = (typeof TOPICS)[number][0];
export function topicFor(g: HelpGuide): Topic {
  const id = g.id;
  if (id.startsWith("team-")) return "team";
  if (id.startsWith("partner")) return "partners";
  if (id.startsWith("affiliate")) return "affiliates";
  if (id.startsWith("custom")) return "custom";
  if (id === "ai-chatbot") return "chatbot";
  if (id === "games-and-accounts" || id === "main-site-resources")
    return "games";
  if (["first-website", "platform-map", "account-to-published"].includes(id))
    return "getting-started";
  if (["templates", "saving", "metrics", "multiple-websites"].includes(id))
    return "websites";
  if (
    [
      "domains",
      "renewals",
      "renewal-checklist",
      "domain-registration-status",
    ].includes(id)
  )
    return "domains";
  if (["business-email", "email-replies-delivery"].includes(id)) return "email";
  if (["payments", "plans", "refunds", "payment-recovery"].includes(id))
    return "billing";
  if (["support-permissions", "reviews"].includes(id)) return "support";
  if (
    ["access", "pwa", "appearance", "ai-receptionist"].includes(id) ||
    /password|profile-photo|offline|sync-safety|team-member|business-details/.test(
      id,
    )
  )
    return "account";
  return "operations";
}
export const PUBLIC_ARTICLES = HELP_GUIDES;
const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchArticles(articles: HelpGuide[], q = "", topic = "all") {
  const words =
    normalize(q.slice(0, 200))
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 1) || [];
  return articles
    .filter((g) => topic === "all" || topicFor(g) === topic)
    .map((g) => {
      const title = normalize(g.title + " " + g.tags.join(" ")),
        body = normalize(
          [g.summary, ...g.steps, ...g.problems, g.escalate].join(" "),
        );
      return {
        g,
        score: words.reduce(
          (n, w) =>
            n + (title.includes(w) ? 8 : 0) + (body.includes(w) ? 1 : 0),
          0,
        ),
        matches: words.every((w) => title.includes(w) || body.includes(w)),
      };
    })
    .filter((r) => !words.length || r.matches)
    .sort((a, b) => b.score - a.score || a.g.title.localeCompare(b.g.title))
    .map((r) => r.g);
}
export function relatedArticles(g: HelpGuide, articles: HelpGuide[]) {
  return articles
    .filter((a) => a.id !== g.id)
    .map((a) => ({
      a,
      score:
        (topicFor(a) === topicFor(g) ? 10 : 0) +
        a.tags.filter((t) => g.tags.includes(t)).length,
    }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.a);
}
export function searchQuery(
  params: Record<string, string | string[] | undefined>,
) {
  return {
    q: typeof params.q === "string" ? params.q.slice(0, 200) : "",
    topic:
      typeof params.topic === "string" &&
      TOPICS.some((t) => t[0] === params.topic)
        ? params.topic
        : "all",
  };
}
