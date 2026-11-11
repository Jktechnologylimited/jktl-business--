/** Visible-tab polling with one request at a time, throttled focus refresh and cleanup.
 * Rejections wait for the next scheduled poll; there is no immediate retry loop.
 */
export function startVisiblePolling(
  refresh: () => Promise<unknown>,
  intervalMs: number,
  minGapMs = 1000,
) {
  let stopped = false,
    pending = false,
    last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule(delay = intervalMs) {
    clearTimeout(timer);
    if (!stopped && !document.hidden) timer = setTimeout(run, delay);
  }
  function run() {
    clearTimeout(timer);
    if (stopped || pending || document.hidden) return;
    const remaining = minGapMs - (Date.now() - last);
    if (remaining > 0) {
      schedule(remaining);
      return;
    }
    pending = true;
    last = Date.now();
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => {
        pending = false;
        schedule();
      });
  }
  function visibility() {
    if (document.hidden) clearTimeout(timer);
    else run();
  }
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("focus", run);
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("focus", run);
  };
}
