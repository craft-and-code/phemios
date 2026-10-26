import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSite, renderMarkdown } from "../scripts/site-content.mjs";
import { installWebDemoFixture } from "./web-demo-publication-fixture.mjs";
import { checkSite } from "../scripts/check-site.mjs";
const root = path.resolve(import.meta.dirname, "..");
for (const language of ["fr", "en"]) {
  test(`website ${language}: the complete manual has valid navigation, assets and explicit ecosystem links`, async () => {
    const out = await mkdtemp(path.join(tmpdir(), "phemios-site-"));
    try {
      const pages = await generateSite(root, out);
      await checkSite(out, { technical: false });
      const home = await readFile(
        path.join(out, language === "fr" ? "index.html" : "en/index.html"),
        "utf8",
      );
      assert.match(home, new RegExp(`<html lang="${language}"`));
      assert.match(home, /href="(?:\.\.\/)?demo\/#\/albums"/);
      assert.match(home, /href="https:\/\/craft-and-code\.github\.io\/aede\/"/);
      assert.match(home, /href="https:\/\/craft-and-code\.github\.io\/FlacCompagnon\/"/);
      assert.doesNotMatch(home, /<iframe|<form|https?:\/\/[^" ]+\.(?:js|css|png|woff)/);
      assert.equal(pages.length, 11);
      for (const page of pages) {
        const text = await readFile(path.join(out, "docs", language, page.slug + ".html"), "utf8");
        assert.ok(text.includes(`../${language === "fr" ? "en" : "fr"}/${page.slug}.html`));
        assert.ok(text.includes(`href="${page.slug}.html" data-search=`));
        assert.match(text, /class="manual-toc"/);
        assert.match(text, /rust\/phemios_core\/index.html/);
        assert.match(text, /components\/index.html/);
      }
      await assert.rejects(checkSite(out), /missing target|ENOENT/);
      for (const name of [
        "components/index.html",
        "components/index.json",
        "rust/phemios_core/index.html",
        "typescript/index.html",
      ]) {
        await mkdir(path.dirname(path.join(out, name)), { recursive: true });
        await writeFile(path.join(out, name), "test-only technical output");
      }
      await installWebDemoFixture(path.join(out, "demo"));
      await checkSite(out);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
}
test("manual rendering keeps literal text and code, rewrites chapter links and refuses executable links", () => {
  const result = renderMarkdown(
    "# Title\n\n## Same title\n\n<script>alert(1)</script> [Next](playback.md) **Read**\n\n## Same title\n\n```\n<a>\n```",
  );
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /href="playback.html"/);
  assert.match(result.html, /<code>&lt;a&gt;<\/code>/);
  assert.deepEqual(
    result.headings.map((h) => h.id),
    ["same-title", "same-title-2"],
  );
  assert.throws(() => renderMarkdown("[Bad](javascript:alert)"), /Unsupported/);
  assert.throws(() => renderMarkdown("```\nnot closed"), /Unclosed/);
});
