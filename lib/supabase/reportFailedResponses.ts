// ABOUTME: A fetch for Supabase clients that reports failed database, auth and storage requests to Sentry.
// ABOUTME: Supabase returns errors instead of throwing them, so they would otherwise go unseen.
import * as Sentry from "@sentry/nextjs";
import { isMissingLogError } from "@/lib/missingLogError";

// Failures the app already explains to the person, as "table:code"
const HANDLED_FAILURES = new Set([
  "favourites:23505",
  // A like already made in another tab, which lib/useLike.ts shows as liked
  "likes:23505",
  "list_likes:23505",
  "list_items:23505",
  // A page past the end of a list, which lib/listPages.ts follows up on
  "list_items:PGRST103",
  // The pin limit, whose message PinButton shows as it is
  "pins:P0001",
  "profiles:23505",
  // A second report of the same thing, which ReportButton treats as done
  "reports:23505",
]);

export type FailedRequest = {
  method: string;
  // The table for database requests, or the API route for auth and storage
  resource: string;
  status: number;
  code: string;
  message: string;
};

// Error bodies differ by Supabase service: the database sends code and
// message, auth sends error_code and msg, storage sends error and message
type ErrorBody = {
  code?: string | number;
  error_code?: string;
  error?: string;
  message?: string;
  msg?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Names an auth or storage request by its route, without the user ids and
// file names later in the path, e.g. "auth/admin/users" or "storage/object/avatars"
function serviceRoute(service: string, path: string): string {
  const segments = path.split("/").filter(Boolean);
  const route = [];
  for (const segment of segments) {
    if (UUID.test(segment) || route.length === 2) break;
    route.push(segment);
  }
  return [service, ...route].join("/");
}

// Returns what to report, or null when the request isn't worth reporting.
// Leaves out the query string and error details, which can hold user data.
export async function describeFailedRequest(
  url: string,
  method: string,
  response: Response,
): Promise<FailedRequest | null> {
  if (response.ok) return null;
  const { pathname } = new URL(url);
  const [, service, version, ...rest] = pathname.split("/");
  if (version !== "v1") return null;

  // Auth and storage answer most bad input (wrong password, expired link,
  // missing file) with a 4xx the app already shows, so only outages count
  const isDatabase = service === "rest";
  if (!isDatabase) {
    if (service !== "auth" && service !== "storage") return null;
    if (response.status < 500) return null;
  }

  // HEAD responses have no body, so the status is all there is to go on
  const body: ErrorBody = await response.json().catch(() => ({}));
  const code = String(
    body.error_code ?? body.code ?? body.error ?? `HTTP ${response.status}`,
  );
  const resource = isDatabase
    ? rest.join("/")
    : serviceRoute(service, rest.join("/"));
  if (HANDLED_FAILURES.has(`${resource}:${code}`)) return null;

  const message = body.message ?? body.msg ?? "No error message";
  // A like or share on a deleted review, which the button explains
  if (
    (resource === "likes" || resource === "shares") &&
    isMissingLogError({ code, message }, resource)
  ) {
    return null;
  }

  return {
    method,
    resource,
    status: response.status,
    code,
    message,
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
      // Sentry titles events by error name, and this name survives minification
      const error = new Error(
        `Supabase ${failure.method} ${failure.resource}: ${failure.message}`,
      );
      error.name = "SupabaseError";
      Sentry.captureException(error, {
        level: "error",
        fingerprint: ["supabase", failure.resource, failure.code],
        tags: { table: failure.resource, sql_code: failure.code },
        extra: { status: failure.status },
      });
    }
  } catch {
    // Reporting must never change what the caller receives
  }
  return response;
}
