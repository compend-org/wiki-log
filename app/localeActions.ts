"use server";

// ABOUTME: Remembers the language a visitor picked for the site.
// ABOUTME: The choice is a cookie, so every page can read it without a sign-in.
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/locales";

export async function setLocale(code: string): Promise<void> {
  if (!isLocale(code)) return;
  (await cookies()).set(LOCALE_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
