import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const root = resolve(import.meta.dirname, "../site");
for (const [page, lang] of [
  ["index.html", "fr"],
  ["en/index.html", "en"],
]) {
  test(`website ${lang}: local assets, anchors, locale and project links stay valid`, () => {
    const file = resolve(root, page),
      html = readFileSync(file, "utf8");
    assert.match(html, new RegExp(`<html lang="${lang}"`));
    assert.match(html, /name="viewport"/);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<script|<iframe|<form|https?:\/\/[^" ]+\.(?:js|css|png|woff)/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (value.startsWith("https://")) continue;
      if (value.startsWith("#")) {
        assert.ok(ids.includes(value.slice(1)), `missing anchor ${value}`);
        continue;
      }
      assert.ok(existsSync(resolve(dirname(file), value)), `missing local target ${value}`);
    }
    assert.match(html, /href="https:\/\/craft-and-code\.github\.io\/aede\/"/);
    assert.match(html, /href="https:\/\/craft-and-code\.github\.io\/FlacCompagnon\/"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.ok(existsSync(resolve(root, lang === "fr" ? "en/index.html" : "index.html")));
  });
}
