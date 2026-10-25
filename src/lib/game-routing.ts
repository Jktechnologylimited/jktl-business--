/** Only these two game surfaces can be auth return destinations. Never use a caller-supplied URL. */
export function gameReturnUrl(next: unknown): string | null {
  if (next === 'games') return 'https://games.jktl.com.ng';
  if (next === 'games-main') return 'https://jktl.com.ng/games';
  return null;
}
