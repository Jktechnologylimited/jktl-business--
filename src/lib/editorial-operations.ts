import "server-only";
import { getSql } from "@/lib/db/client";
import { canPublish } from "@/lib/editorial-policy";
import { mapPublication } from "@/lib/publications";
import { sendEditorialNotice } from "@/lib/email";
export async function runEditorialMaintenance() {
  const sql = getSql();
  let failed = 0,
    published = 0,
    sent = 0;
  const due =
    await sql`SELECT * FROM jktl_publications WHERE status='scheduled' AND scheduled_at<=now() ORDER BY scheduled_at LIMIT 30`;
  for (const r of due) {
    const u = (
      await sql`SELECT * FROM admin_users WHERE id=${r.scheduled_by} AND disabled_at IS NULL AND staff_revoked_at IS NULL`
    )[0];
    const approver = (
      await sql`SELECT * FROM admin_users WHERE id=${r.approved_by} AND disabled_at IS NULL AND staff_revoked_at IS NULL`
    )[0];
    const article = mapPublication(r);
    const sensitive =
      article.kind === "release" ||
      article.sensitive ||
      ["security", "billing", "operations"].includes(
        article.category.toLowerCase(),
      );
    const authorized =
      u &&
      approver &&
      canPublish(
        { id: String(u.id), role: u.role, permissions: u.permission_overrides },
        article,
      ) &&
      (!sensitive || approver.role === "owner");
    if (!authorized) {
      await sql.query(
        `WITH stopped AS(UPDATE jktl_publications SET status='approved',scheduled_at=NULL,scheduled_by=NULL,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 AND status='scheduled' RETURNING *),history AS(INSERT INTO editorial_revisions(publication_id,revision,snapshot,comment) SELECT id,revision,to_jsonb(stopped),'Scheduled publication stopped: publishing authority changed. Owner review required.' FROM stopped) INSERT INTO editorial_notices(publication_id,recipient_id,event,revision) SELECT p.id,u.id,'schedule_failed',p.revision FROM stopped p JOIN admin_users u ON u.role='owner' OR u.id=p.created_by ON CONFLICT DO NOTHING`,
        [r.id, r.revision],
      );
      failed++;
      continue;
    }
    const changed = await sql.query(
      `WITH changed AS(UPDATE jktl_publications SET status='published',published_by=scheduled_by,published_at=now(),scheduled_at=NULL,scheduled_by=NULL,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$2 AND status='scheduled' RETURNING *),history AS(INSERT INTO editorial_revisions(publication_id,revision,actor_id,snapshot,comment) SELECT id,revision,published_by,to_jsonb(changed),'Scheduled publication' FROM changed),notices AS(INSERT INTO editorial_notices(publication_id,recipient_id,event,revision) SELECT p.id,u.id,'published',p.revision FROM changed p JOIN admin_users u ON u.id=p.created_by OR u.id=p.assigned_to ON CONFLICT DO NOTHING) SELECT id FROM changed`,
      [r.id, r.revision],
    );
    published += changed.length;
  }
  const notices = await sql.query(
    `WITH picked AS(SELECT id FROM editorial_notices WHERE sent_at IS NULL AND attempts<8 AND next_attempt_at<=now() AND(lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 30),claimed AS(UPDATE editorial_notices n SET lease_until=now()+interval '5 minutes',attempts=attempts+1 FROM picked WHERE n.id=picked.id RETURNING n.*) SELECT n.*,u.email,u.disabled_at,u.staff_revoked_at,p.title FROM claimed n JOIN admin_users u ON u.id=n.recipient_id LEFT JOIN jktl_publications p ON p.id=n.publication_id`,
  );
  for (const n of notices) {
    if (n.disabled_at || n.staff_revoked_at) {
      await sql`UPDATE editorial_notices SET sent_at=now(),lease_until=NULL WHERE id=${n.id}`;
      continue;
    }
    const result = await sendEditorialNotice(
      String(n.email),
      String(n.event),
      String(n.title || "Your editorial invitation"),
      String(n.id),
    );
    if (result.ok) {
      sent++;
      await sql`UPDATE editorial_notices SET sent_at=now(),lease_until=NULL WHERE id=${n.id}`;
    } else {
      failed++;
      await sql`UPDATE editorial_notices SET lease_until=NULL,next_attempt_at=now()+interval '15 minutes' WHERE id=${n.id}`;
    }
  }
  return { failed, published, sent };
}
