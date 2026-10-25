import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releaseNotes } from "../scripts/release-notes.mjs";
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "phemios-notes-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Release fixture");
    git("config", "user.email", "fixture@example.test");
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "previous release");
    git("tag", "v0.1.0");
    mkdirSync(join(root, "src-tauri"));
    mkdirSync(join(root, "docs/releases"), { recursive: true });
    const json = (name, value) => writeFileSync(join(root, name), JSON.stringify(value));
    json("package.json", { version: "0.2.0" });
    json("package-lock.json", { version: "0.2.0", packages: { "": { version: "0.2.0" } } });
    json("src-tauri/tauri.conf.json", { version: "0.2.0" });
    writeFileSync(join(root, "Cargo.toml"), 'version = "0.2.0"\n');
    writeFileSync(
      join(root, "docs/releases/v0.2.0.md"),
      "# Phémios 0.2.0\n\nAdd saved collections to a custom menu.\n",
    );
    git(
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-m",
      "feat: collection menus [direct commit]",
    );
    const first = git("rev-parse", "HEAD");
    git("tag", "v0.2.0-rc.1");
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "docs: explain navigation");
    const second = git("rev-parse", "HEAD");
    git("tag", "v0.2.0");
    run({ root, git, first, second });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("release notes keep the human feature summary and every commit since the previous stable tag", () =>
  fixture(({ root, first, second }) => {
    const notes = releaseNotes(root, "v0.2.0", "example/phemios");
    assert.match(notes, /Add saved collections to a custom menu/);
    assert.ok(notes.includes(`/commit/${first}`));
    assert.ok(notes.includes(`/commit/${second}`));
    assert.ok(notes.includes("\\[direct commit\\]"));
    assert.doesNotMatch(notes, /previous release/);
    assert.match(notes, /compare\/v0\.1\.0\.\.\.v0\.2\.0/);
  }));
test("a first release includes all commits, without silently accepting incomplete notes", () =>
  fixture(({ root, git }) => {
    git("tag", "-d", "v0.1.0");
    assert.match(releaseNotes(root, "v0.2.0", "example/phemios"), /previous release/);
    assert.throws(() => releaseNotes(root, "v0.3.0", "example/phemios"), /tag/);
    assert.throws(() => releaseNotes(root, "v0.2.0", "https://invalid.example"), /repository/);
    writeFileSync(join(root, "docs/releases/v0.2.0.md"), "# {{version}}");
    assert.throws(() => releaseNotes(root, "v0.2.0", "example/phemios"), /complete/);
  }));
