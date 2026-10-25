import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { releaseVersion } from "./release.mjs";

const escape = (value) => value.replace(/[\\`*_[\]<>]/g, "\\$&");
/** Append actual direct/merge commits to the reviewed human summary for this exact tag. */
export function releaseNotes(root, tag, repository) {
  releaseVersion(root, tag);
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))
    throw new Error("A GitHub owner/repository is required.");
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("rev-parse", "--verify", `${tag}^{commit}`);
  const summary = readFileSync(join(root, "docs/releases", `${tag}.md`), "utf8").trim();
  if (!summary || /\{\{[^}]+\}\}/.test(summary))
    throw new Error("Reviewed, complete version-specific release notes are required.");
  const previous = git("tag", "--merged", tag, "--sort=-version:refname")
    .split("\n")
    .find((name) => name !== tag && /^v\d+\.\d+\.\d+$/.test(name));
  const commits = git("log", "--reverse", "--format=%H %s", previous ? `${previous}..${tag}` : tag)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const hash = line.slice(0, 40),
        subject = line.slice(41);
      if (!/^[0-9a-f]{40}$/.test(hash)) throw new Error("Invalid Git commit identity.");
      return `- [${hash.slice(0, 8)}](https://github.com/${repository}/commit/${hash}) ${escape(subject)}`;
    });
  const comparison = previous
    ? `https://github.com/${repository}/compare/${previous}...${tag}`
    : `https://github.com/${repository}/commits/${tag}`;
  return `${summary}\n\n## Commit history\n\n${commits.join("\n")}\n\n[Full changelog](${comparison})\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [tag, output] = process.argv.slice(2);
  if (!tag || !output) throw new Error("Usage: node scripts/release-notes.mjs vVERSION OUTPUT");
  writeFileSync(
    output,
    releaseNotes(resolve(import.meta.dirname, ".."), tag, process.env.GITHUB_REPOSITORY ?? ""),
  );
}
