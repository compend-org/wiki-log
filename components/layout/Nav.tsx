// ABOUTME: The site-wide top bar: the logo, activity, people search and account links.
// ABOUTME: Logos are imported so their URLs are content-hashed and cached for good.
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import DiaryIcon from "@/components/activity/DiaryIcon";
import CraftIcon from "@/components/craft/CraftIcon";
import PeopleSearch from "@/components/people/PeopleSearch";
import { FEATURES } from "@/lib/features";
import { useNavLinkTone } from "@/lib/hooks/useNavLinkTone";
import { SITE_NAME } from "@/lib/site";
import logoDark from "@/public/logo-dark.png";
import logoLight from "@/public/logo-light.png";

// `account` fills the signed-in part of the bar: the bell, profile and sign in/out
export default function Nav({ account }: { account: ReactNode }) {
  const tone = useNavLinkTone();

  return (
    <nav className="flex relative flex-nowrap items-center justify-between gap-x-3 border-b border-line bg-surface px-4 py-2 text-sm sm:flex-wrap sm:justify-start sm:gap-x-5 sm:gap-y-1 sm:px-8">
      {" "}
      <Link
        href="/"
        prefetch={false}
        className={`sm:mr-2 flex items-center gap-2 text-xl font-bold no-underline ${tone("/")}`}
      >
        {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
        <img
          src={logoLight.src}
          alt=""
          width={35}
          height={35}
          className="logo-light border-0"
        />
        {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
        <img
          src={logoDark.src}
          alt=""
          width={35}
          height={35}
          className="logo-dark border-0"
        />
        <span className="hidden sm:inline">{SITE_NAME}</span>
      </Link>
      <Link
        href="/activity"
        prefetch={false}
        aria-label="Activity"
        title="Activity"
        className={`flex ${tone("/activity")}`}
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
