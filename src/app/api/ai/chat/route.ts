import { runChatTurn } from "@/lib/ai/engine";
import { ensureWidgetSession } from "@/lib/ai/missed-call";
import { packForBusinessType } from "@/lib/ai/industry-packs";
import { listChatMessages } from "@/lib/db/receptionist";
import { getBusinessProfile } from "@/lib/db/organizations";
import { getOrganizationIdBySubdomain } from "@/lib/db/public";

/**
 * One conversational turn with the AI receptionist.
 *
 * Public and unauthenticated by necessity: the whole point is that a patient
 * who just received an SMS — or a visitor reading the clinic's website — can
 * talk without an account. It is safe because the caller can only ever act
 * inside a conversation it already holds, and because the engine derives the
 * organization from the session (or from a published subdomain) rather than
 * accepting one from the client.
 *
 * Two entry points:
 *   { sessionId, text }                      — the SMS link, or a chat already
 *                                              under way on the website
 *   { subdomain, visitorKey, text }           — a new conversation started from
 *                                              the website's chat widget, which
 *                                              the server opens on the visitor's
 *                                              behalf (rate-limited per
 *                                              visitor key — see
 *                                              `ensureWidgetSession`)
 *
 * Guards regardless: the message is length-capped, a session cannot run
 * forever (each turn costs real inference money), and neither a session id nor
 * a subdomain means no work.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Roughly a long paragraph. Anything past this is either a paste or an
 * attempt to stuff the prompt. */
const MAX_MESSAGE_CHARS = 1_500;
/** A booking conversation is a dozen turns; eighty is abuse or a loop. */
const MAX_TURNS_PER_SESSION = 80;

interface ChatRequestBody {
  sessionId?: unknown;
  subdomain?: unknown;
  visitorKey?: unknown;
  text?: unknown;
  quickReply?: unknown;
}

function parseQuickReply(value: unknown): { kind: "book"; serviceId: string; startsAt: string; patientName?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== "book") return undefined;
  const serviceId = typeof raw.serviceId === "string" ? raw.serviceId : "";
  const startsAt = typeof raw.startsAt === "string" ? raw.startsAt : "";
  if (!serviceId || !startsAt) return undefined;
  const patientName = typeof raw.patientName === "string" ? raw.patientName : undefined;
  return { kind: "book", serviceId, startsAt, patientName };
}

export async function POST(req: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  const text = (typeof body.text === "string" ? body.text : "").slice(0, MAX_MESSAGE_CHARS).trim();
  const quickReply = parseQuickReply(body.quickReply);
  if (!text && !quickReply) return Response.json({ ok: false, error: "Nothing to send." }, { status: 400 });

  let sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  // The website widget's first turn: resolve the published site, then open (or
  // resume) a conversation for this visitor.
  if (!sessionId) {
    const subdomain = typeof body.subdomain === "string" ? body.subdomain.trim().toLowerCase() : "";
    if (!subdomain) return Response.json({ ok: false, error: "Missing sessionId or subdomain." }, { status: 400 });

    const organizationId = await getOrganizationIdBySubdomain(subdomain);
    if (!organizationId) return Response.json({ ok: false, error: "That site isn't available." }, { status: 404 });

    const profile = await getBusinessProfile(organizationId);
    const opened = await ensureWidgetSession({
      organizationId,
      packId: packForBusinessType(profile?.businessType).id,
      phone: "",
      visitorKey: typeof body.visitorKey === "string" ? body.visitorKey : "",
    });
    sessionId = opened.sessionId;
  }

  const history = await listChatMessages(sessionId, MAX_TURNS_PER_SESSION + 1);
  if (history.length > MAX_TURNS_PER_SESSION) {
    return Response.json({ ok: false, error: "This conversation has reached its limit. Please call the clinic." }, { status: 429 });
  }

  const result = await runChatTurn({ sessionId, text, quickReply });

  return Response.json(
    {
      ok: result.ok,
      sessionId,
      mode: result.mode,
      reply: result.reply,
      escalated: result.escalated,
      severity: result.severity,
      booking: result.booking,
      quickReplies: result.quickReplies,
      sessionStatus: result.session?.status ?? null,
      error: result.error ?? null,
    },
    { status: result.ok ? 200 : 400 },
  );
}
