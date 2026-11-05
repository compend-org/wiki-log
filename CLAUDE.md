## Supabase CLI

The Supabase CLI is a dev dependency. Run it as `npx supabase`: `.envrc` puts it on PATH only in interactive shells.

## Before opening a pull request

Run the same checks as CI (`.github/workflows/checks.yml`) and fix any failures:

```sh
npx next typegen
npx tsc --noEmit
npx biome ci --max-diagnostics=none .
```
