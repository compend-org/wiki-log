// ABOUTME: Tests for drawing TeX math as pictures for shared images.
// ABOUTME: Covers KaTeX's commands that MathJax lacks, math that doesn't parse, and shrinking or cutting off big math.
import assert from "node:assert/strict";
import { test } from "node:test";
import { texPicture } from "./texPicture";

const options = {
  display: false,
  color: "#000",
  em: 10,
  maxWidth: 1000,
  maxHeight: 1000,
};
const draw = (tex: string, more: Partial<typeof options> = {}) =>
  texPicture(tex, { ...options, ...more });

test("draws KaTeX's own commands", () => {
  for (const tex of [
    "\\KaTeX",
    "\\raisebox{-1em}{Hi}",
    "\\fcolorbox{blue}{green}{\\sf{\\text{boxed}}}",
  ]) {
    assert.ok(draw(tex), tex);
  }
});

test("TeX that doesn't parse gives no picture", () => {
  assert.equal(draw("\\frac{1"), null);
});

test("an array with a tiny \\arraystretch has rows that touch", () => {
  const rule = "\\rule{5pt}{5pt}";
  const picture = draw(
    `\\def\\arraystretch{1e-8}\\begin{array}{l}${rule}\\\\${rule}\\\\${rule}\\end{array}`,
  );
  // Three rows of 0.5em rules, at 10 pixels to the em
  assert.equal(picture?.height, 15);
});

test("one picture's \\def doesn't reach the next", () => {
  const defined = draw("\\def\\x{\\rule{2em}{1em}}\\x");
  const later = draw("\\x");
  assert.equal(defined?.width, 20);
  assert.notEqual(later?.width, 20);
});

test("shrinks wide math to fit and cuts off tall math", () => {
  const wide = draw("\\rule{100em}{1em}");
  assert.equal(wide?.width, 1000);
  assert.equal(wide?.height, 10);

  const tall = draw("\\raisebox{-999999em}{Hi}");
  assert.equal(tall?.height, 1000);
});
