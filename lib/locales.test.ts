// ABOUTME: Tests for choosing which language the site is shown in.
// ABOUTME: A saved choice wins, then the browser's languages in order of preference, then English.
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLocale, isLocale, pickLocale, siteLocaleOf } from "./locales";

test("a saved choice wins over the browser", () => {
  assert.equal(pickLocale("es", "pt-BR,pt;q=0.9"), "es");
});

test("a saved value the site doesn't have is ignored", () => {
  assert.equal(pickLocale("fr", "es"), "es");
  assert.equal(pickLocale("", null), "en");
});

test("the browser's first language the site has is used", () => {
  assert.equal(pickLocale(undefined, "fr-FR,es;q=0.8,en;q=0.5"), "es");
  assert.equal(pickLocale(undefined, "en;q=0.4,pt-BR;q=0.9"), "pt-BR");
});

test("a regional variant gets the language it belongs to", () => {
  assert.equal(pickLocale(undefined, "es-MX"), "es");
  assert.equal(pickLocale(undefined, "pt-PT"), "pt-BR");
  assert.equal(pickLocale(undefined, "PT-br"), "pt-BR");
});

test("no match, a wildcard or nothing gives English", () => {
  assert.equal(pickLocale(undefined, "de,fr;q=0.8,*;q=0.1"), "en");
  assert.equal(pickLocale(undefined, undefined), "en");
  assert.equal(pickLocale(undefined, "es;q=0"), "en");
});

test("isLocale accepts only the site's languages", () => {
  assert.equal(isLocale("pt-BR"), true);
  assert.equal(isLocale("pt"), false);
  assert.equal(isLocale(undefined), false);
});

test("English is written day first, unless the visitor is in the US, Canada or the Philippines", () => {
  assert.equal(formatLocale("en", "GB"), "en-GB");
  assert.equal(formatLocale("en", "AU"), "en-GB");
  assert.equal(formatLocale("en", "US"), "en-US");
  assert.equal(formatLocale("en", "ca"), "en-US");
  assert.equal(formatLocale("en", "PH"), "en-US");
});

test("with no country known, English is day first", () => {
  assert.equal(formatLocale("en", undefined), "en-GB");
  assert.equal(formatLocale("en", null), "en-GB");
  assert.equal(formatLocale("en", ""), "en-GB");
});

test("Spanish and Portuguese keep their own day-first formats", () => {
  assert.equal(formatLocale("es", "US"), "es");
  assert.equal(formatLocale("pt-BR", undefined), "pt-BR");
});

test("a locale with a country belongs to the site's language", () => {
  assert.equal(siteLocaleOf("en-GB"), "en");
  assert.equal(siteLocaleOf("es-MX"), "es");
  assert.equal(siteLocaleOf("pt-PT"), "pt-BR");
  assert.equal(siteLocaleOf("fr-FR"), null);
});
