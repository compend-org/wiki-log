// ABOUTME: Serves /robots.txt, which tells crawlers which pages they may fetch.
// ABOUTME: Keeps AI training and backlink crawlers out; search engines stay allowed.
import type { MetadataRoute } from "next";

// Each page these crawlers fetch costs several database requests, and they
// read nearly every review. Search and link-preview crawlers aren't listed.
const BLOCKED_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Amazonbot",
  "ElevenlabsCrawler",
  "SERankingBacklinksBot",
  "AIWebIndex",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/" },
    ],
  };
}
