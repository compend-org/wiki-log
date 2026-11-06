// ABOUTME: A fetch for Supabase clients that reports failed database requests to Sentry.
// ABOUTME: Supabase returns errors instead of throwing them, so they would otherwise go unseen.
import * as Sentry from "@sentry/nextjs";

// Failures the app already explains to the person, as "table:code"
const HANDLED_FAILURES = new Set(["favourites:23505", "list_items:23505"]);

export type FailedRequest = {
  method: string;
  table: string;
  status: number;
  code: string;
  message: string;
};

// Returns what to report, or null when the request isn't worth reporting.
// Leaves out the query string and error details, which can hold user data.
export async function describeFailedRequest(
  url: string,
  method: string,
  response: Response,
): Promise<FailedRequest | null> {
  const { pathname } = new URL(url);
  if (response.ok || !pathname.startsWith("/rest/v1/")) return null;

  // HEAD responses have no body, so the status is all there is to go on
  const body = await response
    .json()
    .catch(() => ({}) as { code?: string; message?: string });
  const code = body.code ?? `HTTP ${response.status}`;
  const table = pathname.slice("/rest/v1/".length);
  if (HANDLED_FAILURES.has(`${table}:${code}`)) return null;

  return {
    method,
    table,
    status: response.status,
    code,
    message: body.message ?? "No error message",
  };
}

export async function reportFailedResponses(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.ok) return response;

  try {
    const request = input instanceof Request ? input : null;
    const failure = await describeFailedRequest(
      request?.url ?? input.toString(),
      init?.method ?? request?.method ?? "GET",
      response.clone(),
    );
    if (failure) {
      Sentry.captureMessage(
        `Supabase ${failure.method} ${failure.table}: ${failure.message}`,
        {
          level: "error",
          fingerprint: ["supabase", failure.table, failure.code],
          tags: { table: failure.table, sql_code: failure.code },
          extra: { status: failure.status },
        },
      );
    }
  } catch {
    // Reporting must never change what the caller receives
  }
  return response;
}
