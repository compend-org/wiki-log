// ABOUTME: Checks that every language's message file has the same messages as English.
// ABOUTME: A message must use the same arguments and rich-text tags in each language, or the page breaks.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const DIR = join(process.cwd(), "messages");
const SOURCE = "en";

type Messages = { [key: string]: string | Messages };

// Every message by its dotted key, e.g. "lists.picker.noLists"
function flatten(tree: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

// The arguments ({name}, {count, plural, ...}) and rich-text tags (<link>)
// a message uses. Plural and select branches are searched too.
function shape(message: string): string[] {
  const found = new Set<string>();
  for (const tag of message.matchAll(/<\/?([A-Za-z]+)>/g)) {
    found.add(`<${tag[1]}>`);
  }
  const walk = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== "{") continue;
      let depth = 1;
      let j = i + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const inner = text.slice(i + 1, j - 1);
      const comma = inner.indexOf(",");
      found.add(`{${(comma < 0 ? inner : inner.slice(0, comma)).trim()}}`);
      if (comma >= 0) {
        // The branches of a plural or select: each is `key {message}`
        const rest = inner.slice(inner.indexOf(",", comma + 1) + 1);
        for (let k = 0; k < rest.length; k++) {
          if (rest[k] !== "{") continue;
          let d = 1;
          let m = k + 1;
          while (m < rest.length && d > 0) {
            if (rest[m] === "{") d++;
            else if (rest[m] === "}") d--;
            m++;
          }
          walk(rest.slice(k + 1, m - 1));
          k = m - 1;
        }
      }
      i = j - 1;
    }
  };
  walk(message);
  return [...found].sort();
}

function load(language: string): Map<string, string> {
  return flatten(
    JSON.parse(readFileSync(join(DIR, `${language}.json`), "utf8")),
  );
}

const languages = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length))
  .filter((l) => l !== SOURCE);
const source = load(SOURCE);

test("the message files are valid JSON with text for every message", () => {
  for (const [key, text] of source) {
    assert.ok(text.trim().length > 0, `${SOURCE}: ${key} is empty`);
  }
});

for (const language of languages) {
  test(`${language} has exactly the messages ${SOURCE} has`, () => {
    const messages = load(language);
    const missing = [...source.keys()].filter((k) => !messages.has(k));
    const extra = [...messages.keys()].filter((k) => !source.has(k));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
  });

  test(`${language} messages use the same arguments and tags as ${SOURCE}`, () => {
    const messages = load(language);
    const wrong: string[] = [];
    for (const [key, text] of source) {
      const translated = messages.get(key);
      if (translated === undefined) continue;
      if (translated.trim() === "") wrong.push(`${key}: empty`);
      else if (shape(text).join(" ") !== shape(translated).join(" ")) {
        wrong.push(
          `${key}: ${shape(text).join(" ")} vs ${shape(translated).join(" ")}`,
        );
      }
    }
    assert.deepEqual(wrong, []);
  });
}
