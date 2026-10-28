import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { escapeHtml } from "./layout";
import type { Query } from "@/lib/domains/model";
import { ROLE_LABEL, can, type AdminRole } from "@/lib/admin-permissions";
import { mailAddress } from "./addresses";
export const EMAIL_AUDIENCES = {
  SELECTED: "Selected accounts",
  CUSTOMERS: "All customers",
  AFFILIATES: "All affiliates",
  ACTIVE_AFFILIATES: "Active affiliates",
  DORMANT_AFFILIATES: "Dormant affiliates",
  PARTNERS: "All partners",
  APPROVED_PARTNERS: "Approved partners",
  TEAM: "Team",
  ...Object.fromEntries(
    Object.entries(ROLE_LABEL).map(([k, v]) => ["ROLE:" + k, v]),
  ),
};
export function authorizeEmailAudience(role: AdminRole, audience: string) {
  if (
    !Object.hasOwn(EMAIL_AUDIENCES, audience) ||
    (!can(role, "manage_communications") &&
      ![
        "SELECTED",
        "AFFILIATES",
        "ACTIVE_AFFILIATES",
        "DORMANT_AFFILIATES",
        "PARTNERS",
        "APPROVED_PARTNERS",
      ].includes(audience))
  )
    throw Error("This audience is outside your email permissions.");
}
export async function mailRecipients(
  q: Query,
  role: AdminRole,
  audience: string,
  selected: string[] = [],
  candidate?: string,
  kind: "marketing" | "operational" = "marketing",
) {
  authorizeEmailAudience(role, audience);
  if (
    selected.length > 500 ||
    selected.some((v) => !mailAddress(v)) ||
    (audience === "SELECTED" && !selected.length)
  )
    throw Error("Choose 1–500 existing accounts.");
  const roleFilter = audience.startsWith("ROLE:") ? audience.slice(5) : "";
  const rows = await q(
    `SELECT DISTINCT lower(r.email) email FROM(
  SELECT u.email FROM users u WHERE $1 IN('CUSTOMERS','SELECTED') AND $4::boolean AND EXISTS(SELECT 1 FROM organization_members m WHERE m.user_id=u.id AND m.active=true)
  UNION ALL SELECT a.email FROM affiliates a LEFT JOIN affiliate_activity x ON x.affiliate_id=a.id WHERE
   ($1 IN('SELECTED','AFFILIATES','ACTIVE_AFFILIATES','DORMANT_AFFILIATES') AND a.programme='affiliate' AND($1<>'ACTIVE_AFFILIATES' OR a.status='active' AND COALESCE(x.state,'ACTIVE') IN('ACTIVE','WARNED')) AND($1<>'DORMANT_AFFILIATES' OR x.state='DORMANT'))
   OR ($1 IN('SELECTED','PARTNERS','APPROVED_PARTNERS') AND a.programme='partner' AND($1<>'APPROVED_PARTNERS' OR a.status='active' AND a.partner_terms_confirmed=true))
  UNION ALL SELECT email FROM admin_users WHERE $4::boolean AND disabled_at IS NULL AND staff_revoked_at IS NULL AND($1 IN('TEAM','SELECTED') OR $1 LIKE 'ROLE:%' AND role=$3)
 )r WHERE ($1<>'SELECTED' OR lower(r.email)=ANY($2::text[])) AND($5::text IS NULL OR lower(r.email)=$5)
 AND($6='operational' OR EXISTS(SELECT 1 FROM email_preferences p WHERE p.email=lower(r.email) AND p.marketing_opt_in=true AND p.marketing_suppressed=false)
 AND NOT EXISTS(SELECT 1 FROM prospects p WHERE lower(p.email)=lower(r.email) AND(p.suppressed=true OR p.status='suppressed')))
 ORDER BY email LIMIT 501`,
    [
      audience,
      selected,
      roleFilter,
      can(role, "manage_communications"),
      candidate || null,
      kind,
    ],
  );
  if (rows.length > 500)
    throw Error("Narrow this audience to at most 500 accounts.");
  return rows.map((r) => mailAddress(r.email)).filter(Boolean);
}
/** The existing editorial workflow uses Markdown; reuse its format. Raw HTML
 * is disabled and links are restricted to HTTPS or a single mailto mailbox. */
export function composeBody(body: string) {
  if (typeof body !== "string" || body.trim().length < 5 || body.length > 20000)
    throw Error("Write a message of 5–20,000 characters.");
  type Node = {
    type: string;
    value?: string;
    url?: string;
    depth?: number;
    ordered?: boolean;
    children?: Node[];
  };
  let visited = 0;
  const safeUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password
        ? u.href
        : u.protocol === "mailto:" && mailAddress(value.slice(7))
          ? value
          : "";
    } catch {
      return "";
    }
  };
  const render = (node: Node, depth = 0): string => {
    if (depth > 16 || ++visited > 10000) return "";
    const children = () =>
      (node.children || []).map((n) => render(n, depth + 1)).join("");
    const wrap = (tag: string) =>
      "<" + tag + ">" + children() + "</" + tag + ">";
    switch (node.type) {
      case "text":
        return escapeHtml(node.value);
      case "html":
      case "image":
      case "imageReference":
      case "definition":
        return "";
      case "paragraph":
        return wrap("p");
      case "strong":
        return wrap("strong");
      case "emphasis":
        return wrap("em");
      case "blockquote":
        return wrap("blockquote");
      case "list":
        return wrap(node.ordered ? "ol" : "ul");
      case "listItem":
        return wrap("li");
      case "heading":
        return wrap(node.depth === 3 ? "h3" : "h2");
      case "break":
        return "<br>";
      case "thematicBreak":
        return "<hr>";
      case "inlineCode":
        return "<code>" + escapeHtml(node.value) + "</code>";
      case "code":
        return "<pre><code>" + escapeHtml(node.value) + "</code></pre>";
      case "link": {
        const href = safeUrl(node.url || "");
        return href
          ? '<a href="' + escapeHtml(href) + '">' + children() + "</a>"
          : children();
      }
      default:
        return children();
    }
  };
  const html = render(
    unified().use(remarkParse).parse(body) as unknown as Node,
  );
  if (html.length > 200000) throw Error("Use a shorter formatted message.");
  return { html, text: body };
}

export function authorizeComposeReplyTo(
  role: AdminRole,
  branding: {
    defaultReplyTo: string;
    categoryReplyTo: Record<string, string | undefined>;
  },
  reply: string,
) {
  if (
    !can(role, "manage_communications") &&
    reply &&
    ![
      branding.defaultReplyTo,
      branding.categoryReplyTo.affiliate,
      branding.categoryReplyTo.partner,
      branding.categoryReplyTo.support,
    ].includes(reply)
  )
    throw Error(
      "This Reply-To mailbox is outside your programme email permissions.",
    );
}
