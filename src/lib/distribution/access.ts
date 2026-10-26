export const CLIENT_SCOPES = [
  "VIEW_ALLOWED_SERVICES",
  "MANAGE_WEBSITE_CONTENT",
  "PUBLISH_WEBSITE",
  "REQUEST_SERVICE_CHANGES",
] as const;
export function clientScopes(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((s) => !CLIENT_SCOPES.includes(s)))
    throw Error("Invalid permissions");
  return [...new Set(value)];
}
export function validInviteToken(token: string) {
  return /^[a-f0-9]{64}$/.test(token);
}
