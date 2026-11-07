// ABOUTME: Browser errors not worth reporting: dropped connections, cancelled requests, wallet extensions.
// ABOUTME: Each pattern matches one whole error message, so similar-looking errors still get reported.

export const IGNORED_BROWSER_ERRORS: RegExp[] = [
  // A fetch that failed because the connection dropped, as each browser words
  // it. Sentry may append the host, as in "Load failed (compend.org)".
  /^TypeError: (Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.|network error)( \([^)]*\))?$/,
  // A request the page cancelled on purpose, such as when navigating away
  /^AbortError: signal is aborted without reason$/,
  // Crypto wallet extensions writing to the page's window object
  /window\.ethereum/,
];
