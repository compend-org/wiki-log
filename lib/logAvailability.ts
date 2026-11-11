// ABOUTME: Keeps missing logs unavailable across retained feed cards and route refreshes.
// ABOUTME: UUIDs are not reused; only an exact log foreign-key failure marks one missing.
"use client";

import { useSyncExternalStore } from "react";

const missingLogs = new Set<string>();
const listeners = new Set<() => void>();

export const MISSING_LOG_MESSAGE = "This review is no longer available.";

export function isLogUnavailable(logId: string | null): boolean {
  return logId !== null && missingLogs.has(logId);
}

export function markLogUnavailable(logId: string) {
  if (missingLogs.has(logId)) return;
  missingLogs.add(logId);
  for (const listener of listeners) listener();
}

export function subscribeToLogAvailability(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLogUnavailable(logId: string | null) {
  return useSyncExternalStore(
    subscribeToLogAvailability,
    () => isLogUnavailable(logId),
    () => false,
  );
}
