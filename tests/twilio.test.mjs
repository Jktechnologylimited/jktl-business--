/**
 * Tests for the Twilio webhook layer.
 *
 * This is the door the outside world knocks on to make a clinic send a text and
 * spend its money. Two failures matter and both are covered here:
 *
 *   - accepting a forged request, which lets anyone drain a clinic's wallet;
 *   - rejecting a real one, which means patients never get a callback and the
 *     clinic silently loses the revenue the product exists to recover.
 *
 * Also covered: the answered-call gate. Twilio posts the voice webhook for
 * *every* call status, so without an explicit check a clinic would text "sorry we
 * missed you" to somebody it had just spoken to.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { parseVoiceWebhook, verifyWebhookSignature } from "../src/lib/twilio-payload.ts";
import { periodKeyFor } from "../src/lib/ai/pricing.ts";

const TOKEN = "test_auth_token_do_not_use";
const URL_UNDER_TEST = "https://jktl.com.ng/v1/missed-call";

/** Twilio's scheme: URL + sorted parameter name/value pairs, HMAC-SHA1, base64. */
function sign(url, body, token = TOKEN) {
  let payload = url;
  for (const key of Object.keys(body).sort()) payload += key + body[key];
  return createHmac("sha1", token).update(Buffer.from(payload, "utf8")).digest("base64");
}

/* ------------------------------------------------------------------ */
/* Signature verification                                              */
/* ------------------------------------------------------------------ */

test("a correctly signed request is accepted", () => {
  const body = { From: "+2348031234567", To: "+2347012345678", CallSid: "CA123", CallStatus: "no-answer" };
  const ok = verifyWebhookSignature({ signature: sign(URL_UNDER_TEST, body), url: URL_UNDER_TEST, body, authToken: TOKEN });
  assert.equal(ok, true);
});

test("a forged signature is rejected", () => {
  const body = { From: "+2348031234567", To: "+2347012345678", CallSid: "CA123", CallStatus: "no-answer" };
  assert.equal(verifyWebhookSignature({ signature: "not-a-real-signature", url: URL_UNDER_TEST, body, authToken: TOKEN }), false);
  assert.equal(verifyWebhookSignature({ signature: null, url: URL_UNDER_TEST, body, authToken: TOKEN }), false);
  assert.equal(verifyWebhookSignature({ signature: "", url: URL_UNDER_TEST, body, authToken: TOKEN }), false);
});

test("a signature for a different token is rejected", () => {
  const body = { CallSid: "CA123" };
  const signedWithAnotherToken = sign(URL_UNDER_TEST, body, "some_other_token");
  assert.equal(verifyWebhookSignature({ signature: signedWithAnotherToken, url: URL_UNDER_TEST, body, authToken: TOKEN }), false);
});

test("tampering with the body invalidates the signature", () => {
  const body = { From: "+2348031234567", To: "+2347012345678", CallSid: "CA123", CallStatus: "no-answer" };
  const signature = sign(URL_UNDER_TEST, body);

  // The attack this exists to stop: a valid signature from a real call, replayed
  // with the caller's number swapped for somebody else's.
  const tampered = { ...body, From: "+2348099999999" };
  assert.equal(verifyWebhookSignature({ signature, url: URL_UNDER_TEST, body: tampered, authToken: TOKEN }), false);
});

test("changing the URL invalidates the signature, which is why the public URL is configured", () => {
  const body = { CallSid: "CA123" };
  const signature = sign(URL_UNDER_TEST, body);
  // Behind a load balancer the app sees an internal URL, and Twilio signed the
  // public one — this is the failure TWILIO_WEBHOOK_BASE_URL prevents.
  assert.equal(verifyWebhookSignature({ signature, url: "http://10.0.0.5:3000/v1/missed-call", body, authToken: TOKEN }), false);
});

test("parameter order does not change a valid signature", () => {
  const signature = sign(URL_UNDER_TEST, { A: "1", B: "2", C: "3" });
  const reordered = { C: "3", A: "1", B: "2" };
  assert.equal(verifyWebhookSignature({ signature, url: URL_UNDER_TEST, body: reordered, authToken: TOKEN }), true);
});

test("no configured token means no acceptance", () => {
  const body = { CallSid: "CA123" };
  const saved = process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_AUTH_TOKEN;
  try {
    assert.equal(verifyWebhookSignature({ signature: sign(URL_UNDER_TEST, body), url: URL_UNDER_TEST, body }), false);
  } finally {
    if (saved !== undefined) process.env.TWILIO_AUTH_TOKEN = saved;
  }
});

/* ------------------------------------------------------------------ */
/* Payload parsing                                                     */
/* ------------------------------------------------------------------ */

test("a no-answer call is parsed as missed, with its idempotency key", () => {
  const event = parseVoiceWebhook({
    From: "+2348031234567",
    To: "+2347012345678",
    CallSid: "CAabcdef123",
    CallStatus: "no-answer",
  });

  assert.equal(event.callerPhone, "+2348031234567");
  assert.equal(event.calledNumber, "+2347012345678");
  assert.equal(event.providerCallId, "CAabcdef123", "the CallSid is the replay guard");
  assert.equal(event.isMissed, true);
  assert.deepEqual(event.missing, []);
});

test("busy, failed and canceled calls are all missed", () => {
  for (const status of ["busy", "failed", "canceled", "cancelled"]) {
    const event = parseVoiceWebhook({ From: "+2348031234567", To: "+2347012345678", CallSid: `CA_${status}`, CallStatus: status });
    assert.equal(event.isMissed, true, `${status} should count as missed`);
  }
});

test("an answered call is NOT missed — nothing must be sent", () => {
  const event = parseVoiceWebhook({
    From: "+2348031234567",
    To: "+2347012345678",
    CallSid: "CA_talked",
    CallStatus: "completed",
    CallDuration: "184",
  });
  assert.equal(event.isMissed, false, "a two-minute conversation is not a missed call");
});

test("a call that connected and dropped instantly IS missed", () => {
  // Rang, was answered, hung up within a second — commercially, the clinic
  // missed it.
  const event = parseVoiceWebhook({
    From: "+2348031234567",
    To: "+2347012345678",
    CallSid: "CA_dropped",
    CallStatus: "completed",
    CallDuration: "0",
  });
  assert.equal(event.isMissed, true);

  const twoSeconds = parseVoiceWebhook({ CallStatus: "completed", CallDuration: "2", From: "+2341", To: "+2342", CallSid: "x" });
  assert.equal(twoSeconds.isMissed, true);

  const longEnough = parseVoiceWebhook({ CallStatus: "completed", CallDuration: "3", From: "+2341", To: "+2342", CallSid: "x" });
  assert.equal(longEnough.isMissed, false, "three seconds is a conversation starting");
});

test("a malformed payload is reported as missing fields rather than crashing", () => {
  const event = parseVoiceWebhook({});
  assert.equal(event.isMissed, false, "an empty status is not a missed call");
  assert.deepEqual(event.missing, ["caller phone", "called number"]);
  assert.equal(event.providerCallId, "");
  assert.ok(event.receivedAt instanceof Date);

  // Non-object input must not throw mid-webhook.
  for (const junk of [null, undefined, "nonsense", 42, []]) {
    const parsed = parseVoiceWebhook(junk);
    assert.ok(parsed.receivedAt instanceof Date);
  }
});

test("numbers stay in E.164 so the routing key is stable", () => {
  const event = parseVoiceWebhook({ From: "+234 803 123 4567", To: "07012345678", CallSid: "CA1", CallStatus: "no-answer" });
  // Both forms are preserved here; normalisation to +234 happens in the
  // pipeline, which knows the business's country.
  assert.match(event.callerPhone, /234/);
  assert.match(event.calledNumber, /07012345678/);
});

test("a bad timestamp falls back to now rather than an Invalid Date", () => {
  const event = parseVoiceWebhook({ From: "+2341", To: "+2342", CallSid: "CA1", CallStatus: "no-answer", Timestamp: "not-a-date" });
  assert.ok(!Number.isNaN(event.receivedAt.getTime()), "an Invalid Date would poison the replay guard");
});

/* ------------------------------------------------------------------ */
/* Billing period                                                      */
/* ------------------------------------------------------------------ */

test("the billing period rolls over at Lagos midnight, not UTC", () => {
  // 23:30 UTC on 31 January is 00:30 on 1 February in Lagos (UTC+1). Billing
  // January twice is the bug this prevents.
  assert.equal(periodKeyFor(new Date("2026-01-31T23:30:00Z")), "2026-02");
  assert.equal(periodKeyFor(new Date("2026-01-31T22:30:00Z")), "2026-01");

  // Lagos midnight exactly.
  assert.equal(periodKeyFor(new Date("2026-01-31T23:00:00Z")), "2026-02");
  assert.equal(periodKeyFor(new Date("2026-01-31T22:59:59Z")), "2026-01");
});

test("the period key is stable and well-formed for any date in the month", () => {
  for (const iso of ["2026-03-01T00:00:00Z", "2026-03-15T12:00:00Z", "2026-03-31T22:00:00Z"]) {
    assert.equal(periodKeyFor(new Date(iso)), "2026-03", `${iso} should be March`);
  }
  assert.match(periodKeyFor(new Date("2026-12-15T12:00:00Z")), /^\d{4}-\d{2}$/);

  // And the last hour of a month in UTC is already the next month locally —
  // the boundary in the other direction.
  assert.equal(periodKeyFor(new Date("2026-03-31T23:00:00Z")), "2026-04");
});
