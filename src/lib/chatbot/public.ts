import "server-only";
import { after } from "next/server";
import {
  query,
  publicBot,
  session,
  history,
  hash,
  secret,
  requestRate,
  ticket,
  allowedOrigin,
} from "./store";
import { origin, publicOrigin, text, uuid } from "./model";
import { chatStream, isDeepSeekConfigured } from "@/lib/deepseek";
import { turn } from "./engine";
export async function body(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw Error("INVALID_REQUEST");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 16000) {
      await reader.cancel();
      throw Error("INVALID_REQUEST");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("INVALID_REQUEST");
  return value;
}
export function sameOrigin(req: Request) {
  const source = req.headers.get("origin");
  if (source && source !== new URL(req.url).origin && source !== publicOrigin())
    throw Error("ORIGIN_DENIED");
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known = [
    "RATE_LIMIT",
    "ORIGIN_DENIED",
    "CHATBOT_DISABLED",
    "CHAT_SESSION_EXPIRED",
    "CHAT_BUSY",
    "CHAT_SESSION_LIMIT",
    "INVALID_REQUEST",
    "TICKET_EXPIRED",
  ];
  const code = known.find((code) => message.includes(code)) || "REQUEST_FAILED";
  return Response.json(
    { error: code },
    {
      status:
        code === "RATE_LIMIT" || code === "CHAT_BUSY"
          ? 429
          : code === "CHATBOT_DISABLED"
            ? 404
            : code === "ORIGIN_DENIED"
              ? 403
              : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function publicConfig(id: string) {
  const bot = await publicBot(id);
  const cfg = bot.settings;
  const status = (
    await query(
      "SELECT ai_enabled,model_verified,model FROM chatbot_settings WHERE id",
    )
  )[0];
  return {
    aiAvailable: Boolean(
      isDeepSeekConfigured() &&
      status?.ai_enabled &&
      status.model_verified &&
      status.model,
    ),
    id: bot.id,
    name: bot.name,
    slug: bot.slug,
    settings: {
      welcome: cfg.welcome,
      color: cfg.color,
      avatar: cfg.avatar,
      whatsapp: cfg.whatsapp,
      phone: cfg.phone,
      email: cfg.email,
      leadCapture: cfg.leadCapture,
      hideBranding: cfg.hideBranding && bot.limits.remove_branding,
    },
    retentionDays: bot.limits.retention_days,
    advancedLeads: bot.limits.advanced_leads,
    appointments: bot.limits.appointments,
    services: bot.limits.appointments
      ? await query(
          "SELECT id,name FROM services WHERE organization_id=$1 AND active=true ORDER BY name LIMIT 100",
          [bot.organization_id],
        ).then((rows) =>
          rows.map((row) => ({ id: String(row.id), name: String(row.name) })),
        )
      : [],
  };
}
export async function embedTicket(req: Request, id: string) {
  const bot = await publicBot(id),
    source = origin(req.headers.get("origin") || "");
  if (!source || !(await allowedOrigin(bot, source)))
    throw Error("ORIGIN_DENIED");
  const headers = {
    "Access-Control-Allow-Origin": source,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  await requestRate(req, id, "embed", 10);
  return Response.json(
    { ticket: await ticket(id, source, "embed") },
    { headers },
  );
}
export async function startSession(req: Request) {
  sameOrigin(req);
  const input = await body(req),
    id = uuid(input.botId),
    bot = await publicBot(id);
  await requestRate(req, id, "session", 10);
  const value = text(input.ticket, 64, true);
  if (!/^[a-f\d]{64}$/.test(value)) throw Error("TICKET_EXPIRED");
  const token = secret(),
    resume =
      typeof input.resumeToken === "string" &&
      /^[a-f\d]{64}$/.test(input.resumeToken)
        ? input.resumeToken
        : "";
  const rows = await query(
    `WITH picked AS(DELETE FROM chatbot_tickets WHERE token_hash=$1 AND bot_id=$2 AND expires_at>now() RETURNING *),resumed AS(SELECT s.* FROM chatbot_sessions s JOIN picked p ON s.bot_id=p.bot_id AND s.origin=p.origin AND s.kind=p.kind WHERE s.token_hash=$6 AND s.expires_at>now() AND s.delete_at>now() AND s.created_at>now()-make_interval(days=>$5)),inserted AS(INSERT INTO chatbot_sessions(bot_id,organization_id,token_hash,origin,kind,expires_at,delete_at) SELECT $2,$3,$4,picked.origin,picked.kind,now()+interval '24 hours',now()+make_interval(days=>$5) FROM picked WHERE NOT EXISTS(SELECT 1 FROM resumed) RETURNING *),counted AS(UPDATE chatbots b SET conversations_count=conversations_count+1 FROM inserted s WHERE b.id=s.bot_id RETURNING b.id) SELECT * FROM resumed UNION ALL SELECT * FROM inserted`,
    [
      hash(value),
      id,
      bot.organization_id,
      hash(token),
      bot.limits.retention_days,
      resume ? hash(resume) : "",
    ],
  );
  if (!rows[0]) throw Error("TICKET_EXPIRED");
  return Response.json(
    {
      token: resume && rows[0].token_hash === hash(resume) ? resume : token,
      messages: await history(String(rows[0].id)),
      status: rows[0].status,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function messages(req: Request) {
  sameOrigin(req);
  const input = await body(req),
    token = text(input.token, 64, true),
    s = await session(token);
  await requestRate(req, String(s.bot_id), "history", 30);
  return Response.json(
    { messages: await history(String(s.id)), status: s.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function sendMessage(req: Request) {
  sameOrigin(req);
  const input = await body(req),
    token = text(input.token, 64, true),
    s = await session(token),
    bot = await publicBot(String(s.bot_id));
  const question = text(input.text, 1500, true),
    request = uuid(input.requestId);
  await requestRate(req, String(s.bot_id), "message", 20);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let connected = true;
      const emit = (type: string, data: unknown) => {
        if (connected)
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          } catch {
            connected = false;
          }
      };
      try {
        await turn(
          { query, provider: chatStream, configured: isDeepSeekConfigured() },
          {
            session: s,
            bot,
            tokenHash: hash(token),
            request,
            question,
            signal: req.signal,
            emit,
          },
        );
      } catch (error) {
        const code =
          error instanceof Error &&
          /CHAT_BUSY|CHAT_SESSION_LIMIT|CHATBOT_DISABLED|CHAT_SESSION_EXPIRED/.test(
            error.message,
          )
            ? error.message
            : "REQUEST_FAILED";
        emit("error", { message: code });
        emit("done", { mode: "error" });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
export async function lead(req: Request) {
  sameOrigin(req);
  const input = await body(req),
    s = await session(text(input.token, 64, true)),
    bot = await publicBot(String(s.bot_id));
  await requestRate(req, String(bot.id), "lead", 5);
  if (!bot.settings.leadCapture || input.consent !== true)
    throw Error("INVALID_REQUEST");
  const kind = String(input.kind);
  if (
    !["enquiry", "handoff", "appointment"].includes(kind) ||
    (kind === "appointment" && !bot.limits.appointments)
  )
    throw Error("INVALID_REQUEST");
  const name = text(input.name, 120, true),
    email = text(input.email || "", 254),
    phone = text(input.phone || "", 40),
    enquiry = text(input.enquiry, 2000, true),
    requestId = uuid(input.requestId);
  if (
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    (phone && !/^\+?[\d ()-]{7,40}$/.test(phone))
  )
    throw Error("INVALID_REQUEST");
  let appointment: Record<string, string> = {},
    serviceId: string | null = null,
    startsAt: string | null = null;
  if (kind === "appointment") {
    serviceId = uuid(input.serviceId);
    const date = text(input.date, 10, true),
      time = text(input.time, 5, true),
      instant = new Date(`${date}T${time}:00+01:00`);
    if (
      !phone ||
      !email ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}$/.test(time) ||
      !Number.isFinite(instant.getTime()) ||
      instant.getTime() <= Date.now() ||
      instant.getTime() > Date.now() + 366 * 86400000 ||
      new Date(instant.getTime() + 3600000).toISOString().slice(0, 16) !==
        date + "T" + time
    )
      throw Error("INVALID_REQUEST");
    if (
      !(
        await query(
          "SELECT 1 FROM services WHERE id=$1 AND organization_id=$2 AND active=true",
          [serviceId, s.organization_id],
        )
      ).length
    )
      throw Error("INVALID_REQUEST");
    startsAt = instant.toISOString();
    appointment = {
      serviceId,
      date,
      time,
      timezone: "Africa/Lagos",
      status: "awaiting_confirmation",
    };
  }
  const rows = await query(
    `WITH fresh AS(INSERT INTO chatbot_leads(session_id,bot_id,organization_id,request_key,kind,name,email,phone,enquiry,marketing_consent,appointment) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(session_id,request_key) DO NOTHING RETURNING *),customer AS(INSERT INTO customers(id,organization_id,name,email,phone,notes) SELECT id,organization_id,name,email,phone,'Chatbot appointment request' FROM fresh WHERE kind='appointment' ON CONFLICT(id) DO NOTHING RETURNING id),booking AS(INSERT INTO bookings(id,organization_id,customer_id,service_id,starts_at,status,notes,price_kobo,source) SELECT f.id,f.organization_id,c.id,v.id,$13::timestamptz,'pending',f.enquiry,v.price_kobo,'public_site' FROM fresh f JOIN customer c ON c.id=f.id JOIN services v ON v.id=$12::uuid AND v.organization_id=f.organization_id AND v.active WHERE f.kind='appointment' ON CONFLICT(id) DO NOTHING RETURNING id),notice AS(INSERT INTO chatbot_notice_outbox(lead_id,organization_id) SELECT id,organization_id FROM fresh RETURNING id),counted AS(UPDATE chatbots b SET leads_count=leads_count+1,handoffs_count=handoffs_count+CASE WHEN f.kind='handoff' THEN 1 ELSE 0 END FROM fresh f WHERE b.id=f.bot_id RETURNING b.id) SELECT fresh.* FROM fresh`,
    [
      s.id,
      s.bot_id,
      s.organization_id,
      requestId,
      kind,
      name,
      email,
      phone,
      enquiry,
      bot.limits.advanced_leads && input.marketingConsent === true,
      JSON.stringify(appointment),
      serviceId,
      startsAt,
    ],
  );
  if (kind === "handoff")
    await query(
      "UPDATE chatbot_sessions SET status='human' WHERE id=$1 AND organization_id=$2",
      [s.id, s.organization_id],
    );
  if (rows.length)
    after(async () => {
      try {
        const { processChatbotNotices } = await import("./notifications");
        await processChatbotNotices();
      } catch {}
    });
  return Response.json(
    {
      ok: true,
      message:
        kind === "appointment"
          ? "Appointment request received, awaiting business confirmation."
          : "Your request has been sent to the business. This is not a live agent connection.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
