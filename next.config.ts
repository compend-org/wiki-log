import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import {
  ANALYTICS_ASSETS_HOST,
  ANALYTICS_INGEST_HOST,
  ANALYTICS_PROXY_PATH,
} from "./lib/analyticsEvents";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // The diary became the activity page
  async redirects() {
    return [{ source: "/diary", destination: "/activity", permanent: true }];
  },
  // Analytics requests are forwarded to PostHog from this site's own address
  async rewrites() {
    return [
      {
        source: `${ANALYTICS_PROXY_PATH}/static/:path*`,
        destination: `${ANALYTICS_ASSETS_HOST}/static/:path*`,
      },
      {
        source: `${ANALYTICS_PROXY_PATH}/:path*`,
        destination: `${ANALYTICS_INGEST_HOST}/:path*`,
      },
    ];
  },
  // PostHog's addresses end in a slash, which must reach it unchanged
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "ivory-ti",
  project: "compend",
  // Source maps are uploaded when SENTRY_AUTH_TOKEN is set, so Sentry shows
  // the original code instead of minified names
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  release: {
    // Builds on Vercel have no git history, so the commit comes from Vercel
    setCommits: process.env.VERCEL_GIT_COMMIT_SHA
      ? {
          repo: "compend-org/wiki-log",
          commit: process.env.VERCEL_GIT_COMMIT_SHA,
          ignoreMissing: true,
        }
      : false,
  },
  // A failed upload to Sentry shouldn't stop a deploy
  errorHandler: (error) => {
    console.warn("Sentry build step failed:", error);
  },
  silent: !process.env.CI,
});
