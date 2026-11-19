// ABOUTME: Checks that every message the code asks for by name exists in the English messages.
// ABOUTME: A missing key shows as its own name on the page, so this catches it before it ships.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "lib"];

type Messages = { [key: string]: string | Messages };

function keysOf(tree: Messages, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : keysOf(value, `${prefix}${key}.`),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("every message key used in the code exists in the English messages", () => {
  const known = new Set(
    keysOf(JSON.parse(readFileSync(join(ROOT, "messages", "en.json"), "utf8"))),
  );
  const missing: string[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      // t("some.key") and t.rich("some.key", ...)
      for (const match of text.matchAll(/\bt(?:\.rich)?\(\s*"([^"]+)"/g)) {
        if (!known.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
