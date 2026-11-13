// ABOUTME: Reads a required environment variable, failing loudly when it is missing.
// ABOUTME: Callers pass the value as process.env.NAME so Next.js can inline NEXT_PUBLIC_ variables.
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
