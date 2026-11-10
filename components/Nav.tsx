"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FEATURES } from "@/lib/features";
import { SITE_NAME } from "@/lib/site";
import { useNavLinkTone } from "@/lib/useNavLinkTone";
import DiaryIcon from "./DiaryIcon";
import CraftIcon from "./icons/CraftIcon";
import PeopleSearch from "./PeopleSearch";

// `account` fills the signed-in part of the bar: the bell, profile and sign in/out
export default function Nav({ account }: { account: ReactNode }) {
  const tone = useNavLinkTone();

  return (
    <nav className="flex relative flex-nowrap items-center justify-between gap-x-3 border-b border-line bg-surface px-4 py-2 text-sm sm:flex-wrap sm:justify-start sm:gap-x-5 sm:gap-y-1 sm:px-8">
      {" "}
      <Link
        href="/"
        prefetch={false}
        className="sm:mr-2 flex items-center gap-2 text-xl font-bold text-foreground no-underline"
      >
        {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
        <img
          src="/logo-light.png"
          alt=""
          width={35}
          height={35}
          className="logo-light border-0"
        />
        {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
        <img
          src="/logo-dark.png"
          alt=""
          width={35}
          height={35}
          className="logo-dark border-0"
        />
        <span className="hidden sm:inline">{SITE_NAME}</span>
      </Link>
      <Link
        href="/diary"
        prefetch={false}
        aria-label="Diary"
        title="Diary"
        className={`flex ${tone("/diary")}`}
      >
        <DiaryIcon />
      </Link>
      <PeopleSearch />
      {FEATURES.compounds && (
        <Link
          href="/craft"
          aria-label="Craft a compound"
          title="Craft a compound"
          className={`flex ${tone("/craft")}`}
        >
          <CraftIcon />
        </Link>
      )}
      {account}
    </nav>
  );
}
