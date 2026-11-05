## Before opening a pull request

Run the same checks as CI (`.github/workflows/checks.yml`) and fix any failures:

```sh
npx next typegen
npx tsc --noEmit
npx biome ci --max-diagnostics=none .
```

Create branches and pull requests with `git` and `gh` (`gh pr create`), not Graphite (`gt`).
