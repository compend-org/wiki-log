"use client";

import { usePathname } from "next/navigation";
import { loginHref } from "@/lib/redirect";

export function useLoginHref(): string {
  const pathname = usePathname();
  return loginHref(pathname || "/");
}
