// ABOUTME: Colours a nav link by whether it points at the page you're on.
// ABOUTME: Shared by every link in the top bar.
"use client";

import { usePathname } from "next/navigation";

export function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Link blue, with the page you're on in black
export function useNavLinkTone(): (href: string) => string {
  const pathname = usePathname();
  return (href: string) =>
    isCurrentPage(pathname, href)
      ? "text-foreground"
      : "text-accent hover:text-foreground";
}
