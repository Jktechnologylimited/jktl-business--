type Params = Pick<URLSearchParams, "get">;
/** Only a known product destination is carried through account creation; never an arbitrary redirect. */
export function emailIntent(params: Params) {
  if (params.get("next") === "support") return "?next=support";
  if (params.get("next") !== "email") return "";
  const plan = params.get("emailPlan") || params.get("plan") || "";
  return (
    "?next=email" +
    (/^[a-z0-9-]{1,60}$/.test(plan)
      ? "&emailPlan=" + encodeURIComponent(plan)
      : "")
  );
}
export function emailDestination(params: Params) {
  if (params.get("next") === "support") return "/business/help";
  const intent = emailIntent(params);
  if (!intent) return null;
  const plan = new URLSearchParams(intent).get("emailPlan");
  return "/business/email" + (plan ? "?plan=" + encodeURIComponent(plan) : "");
}
