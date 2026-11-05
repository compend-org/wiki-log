<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Before opening a pull request

Run the same checks as CI (`.github/workflows/checks.yml`) and fix any failures:

```sh
npx next typegen
npx tsc --noEmit
npx biome ci --max-diagnostics=none .
```

Create branches and pull requests with `git` and `gh` (`gh pr create`), not Graphite (`gt`).
