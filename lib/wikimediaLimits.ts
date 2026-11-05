// ABOUTME: Works out how long Wikimedia has asked a client to wait, and waits it out until a deadline.
// ABOUTME: Follows the Retry-After rules on Wikimedia's API rate limits page.

// Wikimedia asks for at least this long when a response doesn't say
export const DEFAULT_WAIT_MS = 5000;

// The longest one visitor action waits on Wikimedia before showing an error
export const WAIT_BUDGET_MS = 15000;

// When a client may next send a request to Wikimedia
export type Pause = { until: number };

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

// Sends the request, and again after each wait Wikimedia asks for, sharing
// those waits through `pause`. The request, body included, is cut off at the
// deadline. Returns the last response once Wikimedia stops asking for waits or
// a wait would end after the deadline, or null if the deadline came first.
export async function sendWithinDeadline(
  send: (signal: AbortSignal) => Promise<Response>,
  pause: Pause,
  deadline: number,
): Promise<Response | null> {
  for (;;) {
    const now = Date.now();
    if (now >= deadline || pause.until > deadline) return null;
    if (pause.until > now) {
      // Another request may extend the pause meanwhile, so look again on waking
      await new Promise((resolve) => setTimeout(resolve, pause.until - now));
      continue;
    }

    const res = await readWhole(send, AbortSignal.timeout(deadline - now));
    if (!res) return null;
    const askedMs = requestedWaitMs(res);
    pause.until = Math.max(pause.until, Date.now() + askedMs);
    if (askedMs === 0 || pause.until > deadline) return res;
  }
}

// The response with its body already read, or null if the signal fired first
async function readWhole(
  send: (signal: AbortSignal) => Promise<Response>,
  signal: AbortSignal,
): Promise<Response | null> {
  const aborted = new Promise<null>((resolve) =>
    signal.addEventListener("abort", () => resolve(null), { once: true }),
  );
  try {
    const res = await Promise.race([send(signal), aborted]);
    if (!res) return null;
    const body = await Promise.race([res.arrayBuffer(), aborted]);
    if (!body) return null;
    return new Response(body.byteLength > 0 ? body : null, {
      status: res.status,
      headers: res.headers,
    });
  } catch (e) {
    if (signal.aborted) return null;
    throw e;
  }
}
