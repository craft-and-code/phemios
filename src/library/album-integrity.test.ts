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

it("publishes each completed file while its explicitly started check is still running", async () => {
  const view = setup();
  await view.integrity.start();
  const output = { ...report(), stderr: "" };
  output.stdout = JSON.stringify({
    version: 1,
    files: JSON.parse(output.stdout).files.slice(0, 1),
  });
  output.exit_code = 0;
  const { result: _result, ...running } = complete();
  view.setJobs([{ ...running, status: "running", partial_result: output }]);
  expect(view.integrity.result(paths[0])?.status).toBe("ok");
  expect(view.integrity.result(paths[1])).toBeUndefined();
  expect(view.integrity.busy()).toBe(true);
  view.setJobs([complete()]);
  expect(view.integrity.result(paths[2])?.status).toBe("ko");
});

it("validates partial snapshots with the same file, duplicate, truncation and exit guards", () => {
  const output = { ...report(), stderr: "" };
  output.stdout = JSON.stringify({
    version: 1,
    files: JSON.parse(output.stdout).files.slice(0, 2),
  });
  output.exit_code = 0;
  expect(parseIntegrityResults(output, paths, true).size).toBe(2);
  expect(() => parseIntegrityResults(output, paths)).toThrow();
  for (const invalid of [
    { ...output, output_truncated: true },
    { ...output, exit_code: 1 },
    { ...output, exit_code: 130 },
    { ...output, stderr: "unexpected" },
    { ...output, stdout: JSON.stringify({ version: 1, files: [] }) },
    {
      ...output,
      stdout: JSON.stringify({
        version: 1,
        files: [{ path: "/foreign.flac", status: "ok", verifier: "Rust" }],
      }),
    },
    {
      ...output,
      stdout: JSON.stringify({
        version: 1,
        files: Array(2).fill({ path: paths[0], status: "ok", verifier: "Rust" }),
      }),
    },
  ])
    expect(() => parseIntegrityResults(invalid, paths, true)).toThrow();
});
it("keeps verified partial files on cancellation and discards them when the account is replaced", async () => {
  const view = setup();
  await view.integrity.start();
  const output = {
    ...report(),
    stderr: "",
    exit_code: 0,
    stdout: JSON.stringify({
      version: 1,
      files: [{ path: paths[0], status: "ok", verifier: "Rust" }],
    }),
  };
  view.setJobs([{ ...complete(), status: "cancelled", partial_result: output }]);
  expect(view.integrity.result(paths[0])?.status).toBe("ok");
  expect(view.integrity.busy()).toBe(false);
  view.setSession({ ...owner, account: { ...owner.account, id: "replacement" } });
  expect(view.integrity.result(paths[0])).toBeUndefined();
});

it("keeps a disclosed failed-file result stable while later files finish", async () => {
  const view = setup();
  await view.integrity.start();
  const first = { path: paths[0], status: "ko", verifier: "Rust", message: "MD5 mismatch" };
  const snapshot = (files: unknown[]) => ({
    exit_code: 1,
    stdout: JSON.stringify({ version: 1, files }),
    stderr: "",
    output_truncated: false,
  });
  view.setJobs([{ ...complete(), status: "running", partial_result: snapshot([first]) }]);
  const result = view.integrity.result(paths[0]);
  const detail = createIntegrityDisclosure(() => view.integrity.result(paths[0]));
  detail.toggle();
  view.setJobs([
    {
      ...complete(),
      status: "running",
      partial_result: snapshot([first, { path: paths[1], status: "no_hash", verifier: "Rust" }]),
    },
  ]);
  expect(view.integrity.result(paths[0])).toBe(result);
  expect(detail.open()).toBe(true);
});

it("does not publish a late cancellation error into a replacement account", async () => {
  let reject!: (error: Error) => void;
  const cancel = vi.fn(
    () =>
      new Promise<void>((_resolve, refuse) => {
        reject = refuse;
      }),
  );
  const view = createRoot((end) => {
    dispose = end;
    const [session, setSession] = createSignal<AccountSession | undefined>(owner);
    const [jobs, setJobs] = createSignal<Job[]>([]);
    const integrity = createAlbumIntegrity({
      release: () => "release:fixture",
      session,
      jobs,
      paths: () => paths,
      start: async () => 7,
      cancel,
    });
    return { integrity, setSession, setJobs };
  });
  await view.integrity.start();
  view.setJobs([{ ...complete(), status: "running" }]);
  const pending = view.integrity.cancel();
  expect(cancel).toHaveBeenCalledWith(7, "server");
  view.setSession({ ...owner, account: { ...owner.account, id: "other" } });
  reject(new Error("Old account cancellation error"));
  await pending;
  expect(view.integrity.error()).toBe("");
  expect(view.integrity.result(paths[0])).toBeUndefined();
});

it("clears a prior cancellation failure when the user retries successfully", async () => {
  const view = setup();
  await view.integrity.start();
  view.setJobs([{ ...complete(), status: "running" }]);
  view.cancel.mockRejectedValueOnce(new Error("Temporary cancellation failure"));
  await view.integrity.cancel();
  expect(view.integrity.error()).toContain("Temporary cancellation failure");
  await view.integrity.cancel();
  view.setJobs([{ ...complete(), status: "cancelled" }]);
  expect(view.integrity.error()).toBe("");
});
it("does not show a late cancellation error after the check has already finished", async () => {
  const view = setup();
  await view.integrity.start();
  view.setJobs([{ ...complete(), status: "running" }]);
  let reject!: (failure: Error) => void;
  view.cancel.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, refuse) => {
        reject = refuse;
      }),
  );
  const cancelled = view.integrity.cancel();
  view.setJobs([complete()]);
  reject(new Error("task has already finished"));
  await cancelled;
  expect(view.integrity.result(paths[0])?.status).toBe("ok");
  expect(view.integrity.error()).toBe("");
});

it("retires a cancellation error when the still-running check subsequently finishes", async () => {
  const view = setup();
  await view.integrity.start();
  view.setJobs([{ ...complete(), status: "running" }]);
  view.cancel.mockRejectedValueOnce(new Error("Cancellation transport unavailable"));
  await view.integrity.cancel();
  expect(view.integrity.error()).toContain("Cancellation transport unavailable");
  view.setJobs([complete()]);
  expect(view.integrity.error()).toBe("");
  expect(view.integrity.result(paths[2])?.status).toBe("ko");
});
it("rejects a superseded cancellation error without losing current progressive verdicts", async () => {
  const view = setup();
  await view.integrity.start();
  const { result: _result, ...running } = complete();
  view.setJobs([{ ...running, status: "running", partial_result: { ...report(), stderr: "" } }]);
  let reject!: (failure: Error) => void;
  view.cancel.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, refuse) => {
        reject = refuse;
      }),
  );
  const first = view.integrity.cancel();
  await view.integrity.cancel();
  reject(new Error("Superseded cancellation error"));
  await first;
  expect(view.integrity.error()).toBe("");
  expect(view.integrity.result(paths[0])?.status).toBe("ok");
  expect(view.integrity.busy()).toBe(true);
});

it("requires the current admin owner to cancel even while old task rows remain available", async () => {
  const view = setup();
  await view.integrity.start();
  view.setJobs([{ ...complete(), status: "running" }]);
  expect(view.integrity.canCancel()).toBe(true);
  view.setSession({ ...owner, account: { ...owner.account, role: "user" } });
  expect(view.integrity.canCancel()).toBe(false);
  await view.integrity.cancel();
  view.setSession(undefined);
  expect(view.integrity.canCancel()).toBe(false);
  await view.integrity.cancel();
  expect(view.cancel).not.toHaveBeenCalled();
});
