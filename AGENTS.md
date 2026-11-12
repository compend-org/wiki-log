<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## After making changes

Whenever you finish a change, typecheck and format it with Biome, and fix anything they report:

```sh
npx next typegen && npx tsc --noEmit
npx biome format --write <the files you changed>
```

## Local database

Every worktree shares one local Supabase database. Apply migrations to it only with the Supabase CLI, which records each one as applied, so the next run knows what is still missing:

```sh
npx supabase migration up
```

Never apply a migration's SQL by hand with `psql`; it won't be recorded, and the database drifts from `supabase/migrations`. While a migration is still changing, try it inside `begin; … rollback;` with `psql`, and run `migration up` only once it's final. Never edit a migration after it has been applied; write a new one. Never run `npx supabase db reset` on your own; it wipes everyone's local data. Ask first.

## Before opening a pull request

Run the same checks as CI (`.github/workflows/checks.yml`) and fix any failures:

```sh
npx next typegen
npm test
npx tsc --noEmit
npx biome ci --max-diagnostics=none .
npm run deadcode
```
