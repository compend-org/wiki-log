import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
          repo: "crabbeleo/wiki-log",
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
