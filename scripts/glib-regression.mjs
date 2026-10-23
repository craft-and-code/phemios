// Linux exercises the production graph; macOS can separately test the same GLib API.
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const release = process.argv.includes("--release");
function cargo(args, cwd, env = process.env) {
  const result = spawnSync("cargo", args, { cwd, env, stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw Error(result.error?.message ?? `Cargo exited ${result.status ?? result.signal}`);
}
try {
  const mode = release ? ["--release"] : [];
  if (process.platform === "linux") {
    cargo(["test", "-p", "phemios-glib-regression", ...mode, "--locked", "--offline"], root);
  } else if (process.platform === "darwin") {
    // No SDK installation or product graph change: the host must already provide GLib.
    const probe = spawnSync("pkg-config", ["--exists", "glib-2.0", "gobject-2.0"], {
      stdio: "inherit",
    });
    if (probe.error || probe.status !== 0)
      throw Error(
        "This optional macOS check requires installed GLib development libraries and pkg-config.",
      );
    const temp = await mkdtemp(join(tmpdir(), "phemios-glib-host-"));
    try {
      await writeFile(
        join(temp, "Cargo.toml"),
        `[package]\nname = "phemios-glib-host-regression"\nversion = "0.0.0"\nedition = "2024"\nrust-version = "1.90"\n[workspace]\n[lib]\npath = "lib.rs"\n[dev-dependencies]\nglib = { path = ${JSON.stringify(join(root, "vendor/glib"))}, default-features = false }\n[profile.release]\nopt-level = 3\nlto = true\ncodegen-units = 1\n`,
      );
      await writeFile(
        join(temp, "lib.rs"),
        `#[cfg(test)]\n#[path = ${JSON.stringify(join(root, "crates/phemios-glib-regression/src/variant_tests.rs"))}]\nmod tests;\n`,
      );
      // Seed with product versions; Cargo only adapts this disposable harness lockfile.
      await copyFile(join(root, "Cargo.lock"), join(temp, "Cargo.lock"));
      const env = {
        ...process.env,
        CARGO_TARGET_DIR: join(root, "target/glib-host-regression"),
        CARGO_INCREMENTAL: "0",
      };
      cargo(["test", ...mode, "--offline", "--", "--test-threads=1"], temp, env);
      console.log("macOS GLib library regressions passed; Linux App validation remains pending.");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  } else {
    throw Error(
      "Run GLib regressions on Linux, or the explicit optional macOS host check; this command does not validate Windows.",
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
