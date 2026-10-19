import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getChatSession, getConfig, listChatMessages } from "@/lib/db/receptionist";
import { getBusinessProfile } from "@/lib/db/organizations";
import { listServices } from "@/lib/db/services";
import { getOrganizationIdBySubdomain } from "@/lib/db/public";
import { getPack, packForBusinessType } from "@/lib/ai/industry-packs";
import { buildGreeting } from "@/lib/ai/prompt";
import { ensureWidgetSession, markChatOpened } from "@/lib/ai/missed-call";
import { AiChat } from "@/components/ai/ai-chat";

/**
 * The page the SMS link opens: `jktl.com.ng/chat?id=<session>&phone=<msisdn>`.
 *
 * This is the "context preservation" step of the blueprint. The session id in
 * the URL resolves to a conversation that already knows which clinic this is,
 * which number called, and — if the clinic has them as a patient — their
 * name. The phone parameter is a convenience for the greeting only; the
 * session's own record is authoritative, so a tampered `?phone=` cannot
 * change who the conversation is with or reach another clinic's data.
 *
 * Every failure mode here is patient-facing, so each one is explicit: an
 * expired link says so and offers the clinic's number rather than showing a
 * blank chat.
 */

export const dynamic = "force-dynamic";

// A conversation link is private and single-patient; it must never be
// indexed, previewed or archived by anyone.
export const metadata: Metadata = {
  title: "Chat with the clinic — JKTL",
  robots: { index: false, follow: false },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; phone?: string; subdomain?: string }>;
}) {
  const { id, subdomain } = await searchParams;
  const sessionId = (id ?? "").trim();

  // A visitor who tapped "chat" on the business's public website arrives here
  // with a subdomain instead of a session. Open a widget session for them and
  // continue at the same URL shape the SMS link uses, so both entry points
  // share one page and one conversation model.
  if (!sessionId && subdomain) {
    const organizationId = await getOrganizationIdBySubdomain(subdomain.trim().toLowerCase());
    if (organizationId) {
      const profile = await getBusinessProfile(organizationId);
      const packId = packForBusinessType(profile?.businessType).id;
      const { sessionId: created } = await ensureWidgetSession({ organizationId, packId, phone: "" });
      redirect(`/chat?id=${created}`);
    }
  }

  const session = sessionId ? await getChatSession(sessionId) : null;

  if (!session) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-paper p-6 text-center">
          <h1 className="font-display text-lg font-semibold text-ink">This chat link has expired</h1>
          <p className="mt-2 text-sm text-ink-muted">
            For your privacy, links stop working once a conversation is closed. Please call the clinic back, or use the link in the most recent
            message we sent you.
          </p>
        </div>
      </Shell>
    );
  }

  const [config, profile, services, history, pack] = await Promise.all([
    getConfig(session.organizationId),
    getBusinessProfile(session.organizationId),
    listServices(session.organizationId),
    listChatMessages(session.id, 100),
    Promise.resolve(getPack(session.packId)),
  ]);

  // Mark the funnel's middle step: the patient actually opened the link.
  await markChatOpened(session);

  const businessName = profile?.displayName ?? "the clinic";
  const greeting = buildGreeting({
    customGreeting: config?.greeting ?? "",
    pack,
    businessName,
    patientName: session.visitorName,
  });

  const activeServices = services.filter((s) => s.active);
  const transcript = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, from: m.role === "user" ? ("user" as const) : ("bot" as const), text: m.content }));

  return (
    <Shell>
      <AiChat
        sessionId={session.id}
        businessName={businessName}
        greeting={greeting}
        initialMessages={transcript}
        services={activeServices.map((s) => ({ id: s.id, name: s.name, priceKobo: s.priceKobo }))}
        themeColor={profile?.themeColor || "#0f6e5c"}
        clinicPhone={profile?.phone ?? ""}
        alreadyEscalated={session.escalated}
        packLabel={pack.label}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-8">{children}</div>;
}
