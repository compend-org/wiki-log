"use client";

// ABOUTME: The page's SFW mode for components drawn in the browser, which draw again
// ABOUTME: when it changes, such as when the account's mode arrives after the page.

import { useSyncExternalStore } from "react";
import { currentSfwMode, SFW_CHANGE_EVENT, type SfwMode } from "@/lib/sfw";

function subscribe(onChange: () => void) {
  window.addEventListener(SFW_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(SFW_CHANGE_EVENT, onChange);
}

// Off when drawn on the server, where there is no page yet
export function useSfwMode(): SfwMode {
  return useSyncExternalStore(subscribe, currentSfwMode, () => "off");
}
