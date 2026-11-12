<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database migrations

Always create migration files with the Supabase CLI, never by naming them by hand:

```sh
bunx supabase migration new <name>
```

The CLI stamps the file with the current UTC time. A hand-picked timestamp can sort before migrations production already has, and `supabase db push` then refuses to apply it.

## After making changes

Whenever you finish a change, typecheck and format it with Biome, and fix anything they report:

```sh
npx next typegen && npx tsc --noEmit
npx biome format --write <the files you changed>
```

## Pull requests

Put follow-up changes in the pull request you're already working on, unless you're told to open a separate one.

## Before opening a pull request

Run the same checks as CI (`.github/workflows/checks.yml`) and fix any failures:

```sh
npx next typegen
npm test
npx tsc --noEmit
npx biome ci --max-diagnostics=none .
npm run deadcode
```
