import { createRoot, createSignal } from "solid-js";
import { expect, it, vi } from "vitest";
import { createDiagnosticRead } from "./diagnostic-read";
import { parseDoctor } from "./doctor";
import { parseStatistics, statisticsReader } from "./statistics";
import {
  diagnosticOwner,
  diagnosticDoctor,
  diagnosticStatistics,
} from "./diagnostic-read-test-fixtures";
import type { AccountSession } from "./server";
import type { SourceId } from "./sources";
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (failure: Error) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it.each([
  {
    name: "statistics",
    fixture: diagnosticStatistics,
    parse: (raw: unknown) => parseStatistics(raw, 0),
  },
  { name: "doctor", fixture: diagnosticDoctor, parse: (raw: unknown) => parseDoctor(raw, 0) },
])(
  "keeps $name network and validation errors local and allows an explicit retry",
  async ({ fixture, parse }) => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(fixture());
    let dispose!: () => void;
    const read = createRoot((cleanup) => {
      dispose = cleanup;
      return createDiagnosticRead(
        () => ({ session: diagnosticOwner("local"), source: "local" }),
        async () => parse(await request()),
      );
    });
    try {
      await settle();
      expect(() => read.current()).not.toThrow();
      expect(read.current()).toBeUndefined();
      expect(read.error()).toContain("Unavailable");
      expect(read.loading()).toBe(false);
      await read.refetch();
      await settle();
      expect(() => read.current()).not.toThrow();
      expect(read.current()).toBeUndefined();
      expect(read.error()).toContain("invalide");
      await read.refetch();
      await settle();
      expect(read.current()).toEqual(fixture());
      expect(read.error()).toBe("");
      expect(request).toHaveBeenCalledTimes(3);
    } finally {
      dispose();
    }
  },
);
it("hides previous source values and ignores late old-source success and failures", async () => {
  for (const fails of [false, true]) {
    const old = deferred(),
      next = deferred();
    const firstOwner = diagnosticOwner("local");
    let dispose!: () => void;
    const [owner, setOwner] = createSignal<AccountSession | undefined>(firstOwner);
    const [source, setSource] = createSignal<SourceId>("local");
    const request = vi
      .fn()
      .mockResolvedValueOnce(diagnosticStatistics(0, 2))
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const read = createRoot((cleanup) => {
      dispose = cleanup;
      return createDiagnosticRead(
        () => (owner() ? { session: owner(), source: source() } : false),
        async (key) => parseStatistics(await request(key.source), 0),
      );
    });
    try {
      await settle();
      expect(read.current()?.albums).toBe(2);
      setSource("server");
      expect(read.current()).toBeUndefined();
      expect(read.error()).toBe("");
      expect(read.loading()).toBe(true);
      setOwner(diagnosticOwner("replacement"));
      next.resolve(diagnosticStatistics(0, 7));
      await settle();
      if (fails) old.reject(new Error("Old source unavailable"));
      else old.resolve(diagnosticStatistics(0, 99));
      await settle();
      expect(read.current()?.albums).toBe(7);
      expect(read.error()).toBe("");
      expect(request.mock.calls.map(([source]) => source)).toEqual(["local", "server", "server"]);
      setOwner(undefined);
      expect(read.current()).toBeUndefined();
      expect(read.error()).toBe("");
      expect(read.loading()).toBe(false);
    } finally {
      dispose();
    }
  }
});
it("keeps failed ranking pages local and retries the evicted statistics cache entry", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(diagnosticStatistics())
    .mockRejectedValueOnce(new Error("Page unavailable"))
    .mockResolvedValueOnce(diagnosticStatistics(50));
  const shared = statisticsReader(request);
  const [offset, setOffset] = createSignal(0);
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createDiagnosticRead(
      () => ({ offset: offset(), read: shared }),
      (key) => key.read(key.offset),
    );
  });
  try {
    await settle();
    expect(read.current()?.top.artists.items[0]?.name).toBe("Fixture 0");
    setOffset(50);
    await settle();
    expect(() => read.current()).not.toThrow();
    expect(read.current()).toBeUndefined();
    expect(read.error()).toContain("Page unavailable");
    await read.refetch();
    await settle();
    expect(read.current()?.top.artists.items[0]?.name).toBe("Fixture 50");
    expect(read.error()).toBe("");
    expect(request.mock.calls).toEqual([[0], [50], [50]]);
  } finally {
    dispose();
  }
});
it("never admits a diagnostic read after disposal", async () => {
  const response = deferred();
  let dispose!: () => void;
  const read = createRoot((cleanup) => {
    dispose = cleanup;
    return createDiagnosticRead(
      () => ({ source: "local" }),
      async () => parseDoctor(await response.promise, 0),
    );
  });
  dispose();
  response.resolve(diagnosticDoctor());
  await settle();
  expect(read.current()).toBeUndefined();
  expect(read.error()).toBe("");
  expect(read.loading()).toBe(false);
});
