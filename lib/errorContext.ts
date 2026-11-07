// ABOUTME: Runs work with extra Sentry context attached to any error reported during it.
// ABOUTME: The context stays with that work only, so it never shows up on another request's errors.
import * as Sentry from "@sentry/nextjs";

export function withErrorContext<T>(
  name: string,
  context: Record<string, unknown>,
  work: () => PromiseLike<T>,
): Promise<T> {
  return Sentry.withScope(async (scope) => {
    scope.setContext(name, context);
    return await work();
  });
}
