"use client";

// ABOUTME: Applies the saved theme and SFW mode to the page once it is in the browser.
// ABOUTME: Pages that start with a redirect arrive without the scripts in <head>, so this covers them.
import { useEffect } from "react";
import { applySfw, getStoredSfw } from "@/lib/sfw";
import { applyTheme, getStoredTheme } from "@/lib/theme";

export default function BrowserSettingsSync() {
  useEffect(() => {
    applyTheme(getStoredTheme());
    applySfw(getStoredSfw());
  }, []);
  return null;
}
