// ABOUTME: Works out how long Wikimedia has asked a client to wait before more requests.
// ABOUTME: Follows the Retry-After rules on Wikimedia's API rate limits page.

// Wikimedia asks for at least this long when a response doesn't say
export const DEFAULT_WAIT_MS = 5000;

// How long to wait after this response, or 0 if it isn't asking for a wait.
// Retry-After is either a number of seconds or a date.
export function requestedWaitMs(res: Response): number {
  if (res.status !== 429 && res.status !== 503) return 0;

  const retryAfter = res.headers.get("retry-after");
  if (!retryAfter) return DEFAULT_WAIT_MS;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? DEFAULT_WAIT_MS : Math.max(date - Date.now(), 0);
}
