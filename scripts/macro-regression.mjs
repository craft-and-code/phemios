// Test the reviewed macro sources without adding SDK dependencies to the App.
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { diagnosticCases } from "../tests/macro-diagnostics.mjs";
const root = resolve(import.meta.dirname, "..");
const q = JSON.stringify;
const temp = await mkdtemp(join(tmpdir(), "phemios-macro-regression-"));
const env = {
  ...process.env,
  CARGO_TARGET_DIR: join(root, "target/macro-regression"),
  CARGO_INCREMENTAL: "0",
};
function cargo(args, capture = false) {
  const result = spawnSync("cargo", args, {
    cwd: temp,
    env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!capture && result.status !== 0)
    throw Error(`Cargo exited ${result.status ?? result.signal}`);
  return result;
}
try {
  const patches = ["glib", "glib-macros", "gtk3-macros"]
    .map((name) => `${name} = { path = ${q(join(root, "vendor", name))} }`)
    .join("\n");
  await writeFile(
    join(temp, "Cargo.toml"),
    `[package]
name = "phemios-macro-regression"
version = "0.0.0"
edition = "2021"
rust-version = "1.90"
[workspace]
[lib]
path = "lib.rs"
[features]
linux-gtk = ["dep:gtk"]
[dependencies]
glib = "=0.18.5"
glib-macros = "=0.18.5"
gtk3-macros = "=0.18.2"
gtk = { version = "=0.18.2", optional = true }
syn = { version = "2", features = ["full"] }
proc-macro2 = "1"
proc-macro-crate = "1"
quote = "1"
once_cell = "1"
trybuild2 = "=1.3.0"
[patch.crates-io]
${patches}
`,
  );
  await copyFile(join(root, "Cargo.lock"), join(temp, "Cargo.lock"));
  // Fetch only this disposable test harness. Neither product lockfile is rewritten.
  if (process.argv.includes("--fetch")) cargo(["fetch"]);
  let source = "";
  for (const name of ["attribute_parser", "composite_template_derive", "util"])
    source += `#[cfg(test)] #[path = ${q(join(root, "vendor/gtk3-macros/src", `${name}.rs`))}] mod ${name};\n`;
  source += `#[cfg(test)] #[path = ${q(join(root, "tests/macro-harness/gtk_tests.rs"))}] mod gtk_tests;\n`;
  source += `#[cfg(test)] #[path = ${q(join(root, "tests/macro-harness/glib_tests.rs"))}] mod glib_tests;\n`;
  for (const name of ["test", "properties", "value_delegate_derive", "clone"])
    source += `#[cfg(test)] #[path = ${q(join(root, "vendor/glib-macros/tests", `${name}.rs`))}] mod upstream_${name};\n`;
  source += `#[cfg(test)] #[path = ${q(join(root, "vendor/glib-macros/src/utils.rs"))}] mod upstream_utils;\n`;
  source += `#[cfg(all(test, feature = "linux-gtk"))] #[path = ${q(join(root, "tests/macro-harness/gtk_linux_tests.rs"))}] mod gtk_linux_tests;\n`;
  await writeFile(join(temp, "lib.rs"), source);
  const features = process.platform === "linux" ? ["--features", "linux-gtk"] : [];
  cargo(["test", "--offline", ...features, "--", "--test-threads=1"]);
  for (const item of diagnosticCases) {
    await writeFile(join(temp, "lib.rs"), item.source);
    const result = cargo(["check", "--offline", "--message-format=json"], true);
    const messages = result.stdout
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line))
      .filter((row) => row.reason === "compiler-message")
      .map((row) => row.message);
    const failures = messages.filter((message) => message.level === "error");
    if (
      result.status !== 101 ||
      !failures.some(
        (message) =>
          message.message.includes(item.message) &&
          message.spans.some((span) => span.is_primary && span.file_name === "lib.rs"),
      ) ||
      failures.some((message) => /panicked|proc macro panicked/.test(message.message))
    )
      throw Error(`Invalid compiler refusal for ${item.name}:\n${result.stdout}\n${result.stderr}`);
    console.log(`Diagnostic PASS: ${item.name}`);
  }
  console.log(
    `${diagnosticCases.length} compiler refusals retained useful source diagnostics without macro panics.`,
  );
  if (process.platform !== "linux")
    console.log("Linux GTK type-check and native App acceptance remain pending.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
