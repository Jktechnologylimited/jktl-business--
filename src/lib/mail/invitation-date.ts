/** Invitation expiry is always displayed in West Africa Time, independent of
 * the server's timezone. Never guess a date or display an invalid timestamp. */
export function invitationExpiry(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(+date)) throw Error("Check the invitation expiry.");
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `Your invitation expires on ${day} at ${time} (WAT).`;
}
