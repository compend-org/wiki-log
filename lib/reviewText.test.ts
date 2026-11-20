// ABOUTME: Tests for how review text, written in markdown, shows on the page.
// ABOUTME: Covers formatting, item links and mentions, and which link addresses are let through.
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewText from "../components/logs/ReviewText";
import { mentionToken } from "./format";

const show = (text: string) => renderToStaticMarkup(ReviewText({ text }));

test("shows bold, italic, quotes and lists", () => {
  const html = show("**big** *small*\n> quoted\n\n- one\n- two");
  assert.match(html, /<strong>big<\/strong> <em>small<\/em>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ul>\s*<li>one<\/li>/);
});

test("keeps single line breaks and leading spaces as typed", () => {
  const html = show("line one\nline two\n\n    not code");
  assert.match(html, /line one<br\/>\s*line two/);
  assert.doesNotMatch(html, /<code>/);
});

test("links items and people to their pages", () => {
  const id = "65617370-d22f-4d75-9bf4-456e8caee319";
  const html = show(`[[Q42|Don't *Panic*]] and ${mentionToken(id, "ann_lee")}`);
  assert.match(html, /href="\/item\/Q42"[^>]*>Don&#x27;t \*Panic\*<\/a>/);
  assert.match(html, new RegExp(`href="/people/${id}"[^>]*>@ann_lee</a>`));
});

test("opens web links in a new tab, without passing on credit", () => {
  const html = show("[the cut](https://example.com/a)");
  assert.match(html, /href="https:\/\/example.com\/a"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="nofollow ugc noopener noreferrer"/);
});

test("shows a written-out address shortened", () => {
  const html = show(
    "https://www.example.com/a/very/long/path/that/keeps/going/and/going/forever",
  );
  assert.match(
    html,
    />example.com\/a\/very\/long\/path\/that\/keeps\/going\/and…</,
  );
});

test("lets through only web and site addresses", () => {
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "//evil.com",
  ]) {
    assert.doesNotMatch(show(`[x](${bad})`), /href=/, bad);
  }
});

test("shows typed HTML as text", () => {
  const html = show("<b>hi</b> <script>alert(1)</script>");
  assert.doesNotMatch(html, /<script>|<b>/);
});

test("takes only text between $$ as TeX, leaving dollar signs and code alone", () => {
  const html = show("From $5 to $10\n\n```math\nx^2\n```");
  assert.match(html, /From \$5 to \$10/);
  assert.match(html, /<pre><code class="language-math">x\^2/);
});
