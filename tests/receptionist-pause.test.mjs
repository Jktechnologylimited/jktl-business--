import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as availability from "../src/lib/ai/availability.ts";
const require = createRequire(import.meta.url);
function load(file) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
  )(
    (name) =>
      name.endsWith("availability")
        ? availability
        : name === "server-only"
          ? {}
          : name === "next/server"
            ? { NextResponse: Response }
            : name.startsWith(".") || name.startsWith("@/")
              ? {}
              : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
test("receptionist pause blocks calls, chat sessions, AI bookings and collection before any external side effect", async () => {
  assert.equal(availability.RECEPTIONIST_PAUSED, true);
  const missed = load("src/lib/ai/missed-call.ts");
  assert.equal((await missed.handleMissedCall({})).outcome, "disabled");
  await assert.rejects(
    () =>
      missed.ensureWidgetSession({
        organizationId: "unused",
        packId: "salon",
        phone: "",
      }),
    /temporarily unavailable/,
  );
  const chat = load("src/lib/ai/engine.ts");
  const turn = await chat.runChatTurn({
    sessionId: "unused",
    text: "book now",
  });
  assert.equal(turn.mode, "unavailable");
  assert.equal(turn.booking, null);
  const voice = load("src/lib/ai/voice-webhook.ts");
  assert.equal((await voice.describeEndpoint().json()).paused,true);
  const response = await voice.handleVoiceWebhookRequest(
    new Request("https://business.jktl.com.ng/v1/missed-call", {
      method: "POST",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).outcome, "disabled");
  const api = load("src/app/api/ai/chat/route.ts");
  assert.equal(
    (
      await api.POST(
        new Request("https://business.jktl.com.ng/api/ai/chat", {
          method: "POST",
          body: "not even JSON",
        }),
      )
    ).status,
    503,
  );
  const billing = load("src/lib/ai/auto-charge.ts");
  assert.equal((await billing.collectDueMonth("unused")).status, "not_due");
  assert.deepEqual(await billing.runAutoCharge(), {
    attempted: 0,
    charged: 0,
    failed: 0,
    noCard: 0,
    results: [],
  });
  const rental = load("src/lib/ai/line-rental.ts");
  assert.deepEqual(await rental.runLineRentals(), {
    attempted: 0,
    charged: 0,
    unpaid: 0,
    results: [],
  });
  await assert.rejects(
    () => rental.chargeLineRental("unused"),
    /temporarily unavailable/,
  );
  const actions = load("src/lib/actions/receptionist-actions.ts");
  for (const name of [
    "startWalletTopUpAction",
    "startContractPaymentAction",
    "simulateMissedCallAction",
    "retryMissedCallAction",
    "retryChargeNowAction",
    "saveReceptionistConfigAction",
  ]) {
    assert.equal((await actions[name]({})).ok, false);
  }
  assert.equal((await actions.setAutoChargeAction(true)).ok, false);
});
