import { createRoot, createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import {
  createAlbumIntegrity,
  createIntegrityDisclosure,
  parseIntegrityResults,
  integrityPath,
} from "./album-integrity";
import type { Job } from "./jobs";
import type { AccountSession } from "./server";
const owner: AccountSession = {
  server: "http://localhost:3412",
  account: { id: "a", username: "a", role: "admin" },
};
const paths = ["/fixture/ok.flac", "/fixture/none.flac", "/fixture/bad.flac"];
function report(): NonNullable<Job["result"]> {
  return {
    exit_code: 1,
    output_truncated: false,
    stderr: "One file failed",
    stdout: JSON.stringify({
      version: 1,
      files: paths.map((path, index) => ({
        path,
        status: ["ok", "no_hash", "ko"][index],
        verifier: "Rust",
        ...(index === 2 ? { message: "MD5 mismatch" } : {}),
      })),
    }),
  };
}
let dispose: () => void;
afterEach(() => dispose?.());
function setup(start = vi.fn(async () => 7)) {
  return createRoot((end) => {
    dispose = end;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner),
      [release, setRelease] = createSignal("release:fixture"),
      [jobs, setJobs] = createSignal<Job[]>([]),
      cancel = vi.fn(async () => {});
    const integrity = createAlbumIntegrity({
      release,
      session,
      jobs,
      paths: () => paths,
      start,
      cancel,
    });
    return { integrity, setSession, setRelease, setJobs, start, cancel };
  });
}
const complete = (): Job => ({
  task_id: 7,
  source: "server",
  release: "release:fixture",
  kind: "check",
  status: "failed",
  result: report(),
});
it("reads a failed complete report per exact file, without turning missing hashes into failures", () => {
  const values = parseIntegrityResults(report(), paths);
  expect([...values.values()].map((value) => value.status)).toEqual(["ok", "no_hash", "ko"]);
  expect(values.get(paths[2]!)).toMatchObject({ message: "MD5 mismatch" });
});
it("rejects truncated, foreign, duplicate, missing and unknown file verdicts", () => {
  const valid = report();
  const files = JSON.parse(valid.stdout).files;
  const malformed = [
    { ...valid, output_truncated: true },
    { ...valid, exit_code: 0 },
    { ...valid, exit_code: NaN },
    { ...valid, stdout: "x".repeat(65537) },
    ...[
      { version: 2, files },
      { version: 1, files: files.slice(0, 2) },
      { version: 1, files: [files[0], files[0], files[2]] },
      { version: 1, files: [{ ...files[0], path: "/other.flac" }, ...files.slice(1)] },
      { version: 1, files: [{ ...files[0], status: "verified" }, ...files.slice(1)] },
      { version: 1, files: [{ ...files[0], message: "x".repeat(4097) }, ...files.slice(1)] },
    ].map((value) => ({ ...valid, stdout: JSON.stringify(value) })),
  ];
  for (const value of malformed) expect(() => parseIntegrityResults(value, paths)).toThrow();
});
it("shows only the check explicitly started by this mounted album and clears on navigation", async () => {
  const view = setup();
  view.setJobs([complete()]);
  expect(view.integrity.result(paths[0])).toBeUndefined();
  await view.integrity.start();
  expect(view.integrity.result(paths[0])?.status).toBe("ok");
  view.setRelease("release:other");
  expect(view.integrity.result(paths[0])).toBeUndefined();
  view.setRelease("release:fixture");
  expect(view.integrity.result(paths[0])).toBeUndefined();
  dispose();
  const remounted = setup();
  remounted.setJobs([complete()]);
  expect(remounted.integrity.result(paths[0])).toBeUndefined();
});
it("never publishes late admission or old results into a replaced account", async () => {
  let accept!: (id: number) => void;
  const view = setup(
    vi.fn(
      () =>
        new Promise<number>((resolve) => {
          accept = resolve;
        }),
    ),
  );
  const pending = view.integrity.start();
  expect(view.integrity.busy()).toBe(true);
  view.setSession({ ...owner, account: { ...owner.account, id: "b" } });
  view.setJobs([complete()]);
  accept(7);
  await pending;
  expect(view.integrity.result(paths[0])).toBeUndefined();
  expect(view.integrity.busy()).toBe(false);
  view.setSession(undefined);
  await view.integrity.start();
  expect(view.start).toHaveBeenCalledTimes(1);
});
it("keeps fresh activity cancellable on its source and hides invalid partial output", async () => {
  const view = setup();
  await view.integrity.start();
  view.setJobs([{ ...complete(), status: "running" }]);
  expect(view.integrity.busy()).toBe(true);
  await view.integrity.start();
  expect(view.start).toHaveBeenCalledTimes(1);
  await view.integrity.cancel();
  expect(view.cancel).toHaveBeenCalledWith(7, "server");
  view.setJobs([{ ...complete(), result: { ...report(), output_truncated: true } }]);
  expect(view.integrity.result(paths[0])).toBeUndefined();
  expect(view.integrity.error()).toContain("invalide ou incomplet");
});

it("reads exact file identities from lightweight track tokens without URL decoding or path normalization", () => {
  const path = "/music/Ozzy:100%/Title.flac";
  for (const prefix of ["track:", "track:@phemios/local/", "track:@phemios/server/"])
    expect(integrityPath(prefix + path)).toBe(path);
  expect(integrityPath("track:@phemios/local/C:\\Music\\Title.flac")).toBe("C:\\Music\\Title.flac");
  for (const invalid of [
    "artist:/music/a.flac",
    "track:relative",
    "track:@phemios/unknown//music/a.flac",
    "track:",
  ])
    expect(integrityPath(invalid)).toBeUndefined();
});

it("discloses only the chosen failed result and closes for a fresh or cleared verdict", () => {
  createRoot((end) => {
    dispose = end;
    const [result, setResult] = createSignal<
      import("./album-integrity").IntegrityResult | undefined
    >({ status: "ko", verifier: "Rust", message: "MD5 mismatch" });
    const detail = createIntegrityDisclosure(result);
    expect(detail.open()).toBe(false);
    detail.toggle();
    expect(detail.open()).toBe(true);
    detail.toggle();
    expect(detail.open()).toBe(false);
    detail.toggle();
    detail.close();
    expect(detail.open()).toBe(false);
    detail.toggle();
    setResult({ status: "ko", verifier: "Rust", message: "Read failed" });
    expect(detail.open()).toBe(false);
    detail.toggle();
    setResult(undefined);
    expect(detail.open()).toBe(false);
  });
});
it("never opens integrity error details for success or an absent reference digest", () => {
  createRoot((end) => {
    dispose = end;
    const [result, setResult] = createSignal<
      import("./album-integrity").IntegrityResult | undefined
    >();
    const detail = createIntegrityDisclosure(result);
    for (const value of [
      undefined,
      { status: "ok" as const, verifier: "Rust" },
      { status: "no_hash" as const, verifier: "Rust" },
    ]) {
      setResult(value);
      detail.toggle();
      expect(detail.open()).toBe(false);
    }
  });
});
