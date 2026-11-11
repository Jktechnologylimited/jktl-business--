/** Public templates, games, customer sites and partner/team flows do not need a
 * business owner's full offline store. Their own server actions still enforce
 * session/tenant permissions independently.
 */
export function needsBusinessBootstrap(pathname: string) {
  return /^\/(?:business|onboarding|login|signup)(?:\/|$)/.test(pathname);
}
