// ABOUTME: Recognises errors caused by a dropped or failed connection.
// ABOUTME: Lets error screens tell people to check their connection and try again.

// Chrome, Firefox and Safari word a failed or interrupted fetch differently
const CONNECTION_MESSAGES = [
  "network error",
  "failed to fetch",
  "networkerror when attempting to fetch resource",
  "load failed",
];

export function isConnectionError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    CONNECTION_MESSAGES.some((message) =>
      error.message.toLowerCase().startsWith(message),
    )
  );
}
