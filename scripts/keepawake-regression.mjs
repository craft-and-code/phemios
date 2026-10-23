// Always use fresh private buses: this test must never inhibit the real desktop.
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const temp = await mkdtemp("/tmp/phemios-awake-");
const children = [];
const sockets = new Set();
const blackhole = createServer((socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});
async function bus(name) {
  const child = spawn(
    "dbus-daemon",
    ["--session", "--nofork", "--print-address=1", `--address=unix:path=${join(temp, name)}`],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  children.push(child);
  return await new Promise((resolveBus, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(Error("Private bus startup timed out")), 5000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`Private bus exited ${code}`));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("\n")) {
        clearTimeout(timer);
        resolveBus(output.split("\n")[0]);
      }
    });
  });
}
function cargo(args, env) {
  const result = spawnSync("cargo", args, { cwd: temp, env, stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw Error(result.error?.message ?? `Cargo exited ${result.status ?? result.signal}`);
}
try {
  if (!["darwin", "linux"].includes(process.platform))
    throw Error("Run the Linux-backend harness on Linux or the explicit Unix host check.");
  const version = "6.1.0";
  const features = 'default-features = false, features = ["tokio", "proxy", "tracing"]';
  await writeFile(
    join(temp, "Cargo.toml"),
    `[package]\nname = "phemios-keepawake-regression"\nversion = "0.0.0"\nedition = "2021"\nrust-version = "1.90"\n[workspace]\n[features]\nfixture-service = ["zbus/service"]\n[lib]\npath = "lib.rs"\n[dependencies]\nzbus = { version = "=${version}", ${features} }\ntokio = { version = "=1.53.3", features = ["rt-multi-thread", "time", "net"] }\n`,
  );
  const source = join(root, "vendor/keepawake/src/sys/linux.rs");
  await writeFile(
    join(temp, "lib.rs"),
    `#![cfg(test)]\n#[path = ${JSON.stringify(join(root, "tests/keepawake-harness/options.rs"))}] mod input;\nuse input::Options;\n#[path = ${JSON.stringify(source)}] mod linux;\n#[cfg(not(feature = "fixture-service"))] const _: fn(Options) -> Result<linux::KeepAwake, zbus::Error> = linux::KeepAwake::new;\n#[cfg(feature = "fixture-service")] type TestFd = zbus::OwnedFd;\n#[cfg(feature = "fixture-service")] #[path = ${JSON.stringify(join(root, "tests/keepawake-harness/fixtures.rs"))}] mod fixtures;\n#[cfg(feature = "fixture-service")] #[path = ${JSON.stringify(join(root, "tests/keepawake-harness/backend_tests.rs"))}] mod tests;\n`,
  );
  await copyFile(join(root, "Cargo.lock"), join(temp, "Cargo.lock"));
  const env = {
    ...process.env,
    CARGO_INCREMENTAL: "0",
    CARGO_TARGET_DIR: join(root, "target/keepawake-regression"),
    PHEMIOS_PRIVATE_DBUS: "1",
    DBUS_SESSION_BUS_ADDRESS: await bus("session"),
    DBUS_SYSTEM_BUS_ADDRESS: await bus("system"),
  };
  delete env.PHEMIOS_BLACKHOLE_BUS;
  if (process.argv.includes("--fetch")) cargo(["fetch"], env);
  cargo(["check", "--tests", "--offline"], env);
  cargo(
    [
      "clippy",
      "--all-targets",
      "--features",
      "fixture-service",
      "--offline",
      "--",
      "-D",
      "warnings",
    ],
    env,
  );
  cargo(
    [
      "test",
      "--features",
      "fixture-service",
      "--offline",
      "--",
      "--test-threads=1",
      "--skip",
      "stalled_authentication_is_bounded_and_rolls_back_display",
    ],
    env,
  );
  await new Promise((accept, reject) => {
    blackhole.once("error", reject);
    blackhole.listen(join(temp, "blackhole"), accept);
  });
  cargo(
    [
      "test",
      "--features",
      "fixture-service",
      "--offline",
      "stalled_authentication_is_bounded_and_rolls_back_display",
      "--",
      "--test-threads=1",
    ],
    {
      ...env,
      PHEMIOS_BLACKHOLE_BUS: "1",
      DBUS_SYSTEM_BUS_ADDRESS: `unix:path=${join(temp, "blackhole")}`,
    },
  );
  console.log(
    "14 private-bus Linux-backend cases passed; real Linux desktop acceptance remains separate.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.destroy();
  if (blackhole.listening) await new Promise((done) => blackhole.close(done));
  for (const child of children) {
    child.kill();
    if (child.pid && child.exitCode === null && child.signalCode === null)
      await new Promise((done) => child.once("exit", done));
  }
  await rm(temp, { recursive: true, force: true });
}
