/** Presentation only: callers supply navigation already filtered by capability. */
export type WorkspaceLink = { href: string; label: string };

const SECTIONS = [
  { id: "customers", label: "Customers", routes: ["/admin", "/admin/custom-projects", "/admin/emails/renewals", "/admin/support", "/admin/support/follow-ups", "/admin/partner-support", "/admin/reviews"] },
  { id: "communications", label: "Communications", routes: ["/admin/emails", "/admin/broadcasts", "/admin/content", "/admin/chatbot"] },
  { id: "growth", label: "Growth & programmes", routes: ["/admin/prospects", "/admin/affiliates", "/admin/partners", "/admin/distribution", "/admin/growth"] },
  { id: "services", label: "Services", routes: ["/admin/domains", "/admin/business-email", "/admin/website-refunds", "/admin/features"] },
  { id: "company", label: "Company & team", routes: ["/admin/insights", "/admin/team", "/admin/team/structure", "/admin/team/payments"] },
  { id: "help", label: "Your workspace", routes: ["/admin/knowledge", "/admin/team/payment-details"] },
] as const;

export function activeWorkspaceLink(nav: WorkspaceLink[], path: string) {
  return nav.filter(({ href }) => path === href || (href !== "/admin" && path.startsWith(href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function groupAdminNavigation(nav: WorkspaceLink[], search = "") {
  const query = search.trim().toLowerCase();
  const known = new Set<string>(SECTIONS.flatMap(section => [...section.routes]));
  const sections: { id: string; label: string; items: WorkspaceLink[] }[] = SECTIONS.map(section => ({
    id: section.id, label: section.label,
    items: section.routes.flatMap(href => nav.filter(item => item.href === href)),
  }));
  // A future permitted route must remain reachable even before it is categorised.
  const remaining = nav.filter(item => !known.has(item.href));
  if (remaining.length) sections.push({ id: "other", label: "Other tools", items: remaining });
  return sections.map(section => ({ ...section, items: section.items.filter(item =>
    !query || `${section.label} ${item.label}`.toLowerCase().includes(query),
  ) })).filter(section => section.items.length);
}
